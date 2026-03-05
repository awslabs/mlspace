#
#   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
#   Licensed under the Apache License, Version 2.0 (the "License").
#   You may not use this file except in compliance with the License.
#   You may obtain a copy of the License at
#
#       http://www.apache.org/licenses/LICENSE-2.0
#
#   Unless required by applicable law or agreed to in writing, software
#   distributed under the License is distributed on an "AS IS" BASIS,
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#   See the License for the specific language governing permissions and
#   limitations under the License.
#

"""
BFF Authentication Lambda Functions.

Implements Backend for Frontend authentication endpoints including login,
callback, logout, identity, and cross-domain synchronization.
"""

import json
import logging
import os
import time
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse

import boto3
from authlib.common.security import generate_token

from ml_space_lambda.auth.handlers.oidc_handler import OIDCConfig, OIDCHandler
from ml_space_lambda.auth.models.auth_models import AuthError, AuthStatus, IdentityResponse, SessionInfo, UserData
from ml_space_lambda.auth.session.key_manager import VersionedKeyManager, VersionedTokenEncryption
from ml_space_lambda.auth.session.manager import OTACManager, SessionManager
from ml_space_lambda.auth.utils.cookies import (
    clear_session_cookie,
    clear_state_cookie,
    create_json_response,
    create_redirect_response,
    create_session_cookie,
    create_state_cookie,
    extract_domain_from_host,
    get_cookie_value,
    should_set_secure_flag,
)
from ml_space_lambda.auth.utils.otac import build_domain_list, build_sync_chain_url, should_initiate_sync
from ml_space_lambda.auth.utils.state import StateManager, decode_state_key_from_storage
from ml_space_lambda.data_access_objects.user import TIMEZONE_PREFERENCE_KEY, UserDAO, UserModel
from ml_space_lambda.enums import TimezonePreference
from ml_space_lambda.utils.mlspace_config import get_environment_variables

logger = logging.getLogger(__name__)

# Initialize AWS clients
ssm_client = boto3.client("ssm")
secrets_client = boto3.client("secretsmanager")


class IdPType(str, Enum):
    """Identity Provider type enumeration."""

    OIDC = "oidc"
    SAML = "saml"


def _get_auth_config() -> Dict[str, str]:
    """
    Get authentication configuration from environment variables.

    Returns:
        Dictionary of authentication configuration

    Raises:
        Exception: If required configuration is missing or invalid
    """
    config = {
        "idp_type": os.environ.get("AUTH_IDP_TYPE", IdPType.OIDC),
        "oidc_url": os.environ.get("AUTH_OIDC_URL", ""),
        "oidc_client_id": os.environ.get("AUTH_OIDC_CLIENT_ID", ""),
        "oidc_client_secret_name": os.environ.get("AUTH_OIDC_CLIENT_SECRET_NAME", ""),
        "oidc_use_pkce": os.environ.get("AUTH_OIDC_USE_PKCE", "true").lower() == "true",
        "oidc_verify_ssl": os.environ.get("AUTH_OIDC_VERIFY_SSL", "true").lower() == "true",
        "oidc_verify_signature": os.environ.get("AUTH_OIDC_VERIFY_SIGNATURE", "true").lower() == "true",
        "state_encryption_key_secret_name": os.environ.get("AUTH_STATE_ENCRYPTION_KEY_SECRET_NAME", ""),
        "token_encryption_key_secret_name": os.environ.get("AUTH_TOKEN_ENCRYPTION_KEY_SECRET_NAME", ""),
        "session_table_name": os.environ.get("AUTH_SESSION_TABLE_NAME", ""),
        "sync_domains": os.environ.get("AUTH_SYNC_DOMAINS", ""),
    }

    # Validate IdP type first
    if config["idp_type"] != IdPType.OIDC:
        raise Exception(f"Unsupported IdP type: {config['idp_type']}. Only '{IdPType.OIDC.value}' is currently supported.")

    # Validate required configuration for OIDC
    if not config["oidc_url"]:
        raise Exception("AUTH_OIDC_URL environment variable is required")

    if not config["oidc_client_id"]:
        raise Exception("AUTH_OIDC_CLIENT_ID environment variable is required")

    if not config["state_encryption_key_secret_name"]:
        raise Exception("AUTH_STATE_ENCRYPTION_KEY_SECRET_NAME environment variable is required")

    if not config["token_encryption_key_secret_name"]:
        raise Exception("AUTH_TOKEN_ENCRYPTION_KEY_SECRET_NAME environment variable is required")

    if not config["session_table_name"]:
        raise Exception("AUTH_SESSION_TABLE_NAME environment variable is required")

    return config


def _get_ssm_parameter(parameter_name: str, decrypt: bool = True) -> str:
    """
    Get parameter value from AWS Systems Manager Parameter Store.

    Args:
        parameter_name: SSM parameter name
        decrypt: Whether to decrypt SecureString parameters

    Returns:
        Parameter value

    Raises:
        Exception: If parameter retrieval fails
    """
    try:
        response = ssm_client.get_parameter(Name=parameter_name, WithDecryption=decrypt)
        return response["Parameter"]["Value"]
    except Exception as e:
        logger.error(f"Failed to get SSM parameter {parameter_name}: {e}")
        raise Exception(f"Configuration error: Unable to retrieve {parameter_name}")


def _get_secret_value(secret_arn: str, key: str = "key") -> str:
    """
    Get secret value from AWS Secrets Manager.

    Args:
        secret_arn: Secret ARN or name
        key: JSON key to extract from the secret (default: "key")

    Returns:
        Secret value for the specified key

    Raises:
        Exception: If secret retrieval fails
    """
    try:
        response = secrets_client.get_secret_value(SecretId=secret_arn)
        return json.loads(response["SecretString"])[key]

    except Exception as e:
        logger.error(f"Failed to get secret {secret_arn}: {e}")
        raise Exception(f"Configuration error: Unable to retrieve secret {secret_arn}")


def _get_versioned_secret_value(secret_arn: str, key: str = "key") -> str:
    """
    Get secret value from AWS Secrets Manager.

    Expects the new versioned format (VersionedKeyData structure).

    Args:
        secret_arn: Secret ARN or name
        key: Unused parameter (kept for API compatibility)

    Returns:
        Current key from versioned secret

    Raises:
        Exception: If secret retrieval fails
    """
    try:
        response = secrets_client.get_secret_value(SecretId=secret_arn)

        # Always expect versioned format
        from ml_space_lambda.auth.models.key_models import VersionedKeyData

        key_data = VersionedKeyData.from_secrets_manager_format(response["SecretString"])
        return key_data.get_current_key()

    except Exception as e:
        logger.error(f"Failed to get secret {secret_arn}: {e}")
        raise Exception(f"Configuration error: Unable to retrieve secret {secret_arn}")


def _create_auth_handler(config: Dict[str, str]) -> OIDCHandler:
    """
    Create authentication handler based on configuration.

    Args:
        config: Authentication configuration

    Returns:
        Configured OIDC authentication handler

    Raises:
        Exception: If handler creation fails or IdP type is not supported
    """
    # This function currently only supports OIDC
    # The IdP type validation should have already been done in _get_auth_config()
    # but we double-check here for safety
    if config["idp_type"] != IdPType.OIDC:
        raise Exception(f"Unsupported IdP type: {config['idp_type']}. Only '{IdPType.OIDC.value}' is currently supported.")

    # OIDC-specific handler creation
    # Get OIDC client secret if configured
    client_secret = None
    if config["oidc_client_secret_name"]:
        try:
            client_secret = _get_secret_value(config["oidc_client_secret_name"], "client_secret")
        except Exception as e:
            logger.warning(f"Failed to retrieve OIDC client secret: {e}")
            # Continue without client secret (PKCE flow)

    # Create OIDC configuration
    oidc_config = OIDCConfig(
        issuer_url=config["oidc_url"],
        client_id=config["oidc_client_id"],
        client_secret=client_secret,
        scopes=["openid", "profile", "email"],
        use_pkce=config["oidc_use_pkce"],
        verify_ssl=config["oidc_verify_ssl"],
        verify_signature=config["oidc_verify_signature"],
    )

    return OIDCHandler(oidc_config)


def _create_state_manager(config: Dict[str, str]) -> StateManager:
    """
    Create state manager for CSRF protection.

    Args:
        config: Authentication configuration

    Returns:
        Configured state manager

    Raises:
        Exception: If state manager creation fails
    """
    try:
        # Get state encryption key from Secrets Manager
        encoded_key = _get_versioned_secret_value(config["state_encryption_key_secret_name"])
        encryption_key = decode_state_key_from_storage(encoded_key)

        return StateManager(encryption_key)
    except Exception as e:
        logger.error(f"Failed to create state manager: {e}")
        raise Exception("Configuration error: Unable to initialize state management")


def _create_token_encryption(config: Dict[str, str]) -> VersionedTokenEncryption:
    """
    Create versioned token encryption instance for securing IdP tokens.

    Args:
        config: Authentication configuration

    Returns:
        Configured versioned token encryption instance

    Raises:
        Exception: If token encryption creation fails
    """
    try:
        # Use versioned key manager for token encryption
        key_manager = VersionedKeyManager(secret_arn=config["token_encryption_key_secret_name"], key_type="token")
        return VersionedTokenEncryption(key_manager)
    except Exception as e:
        logger.error(f"Failed to create versioned token encryption: {e}")
        raise Exception("Configuration error: Unable to initialize token encryption")


def _create_session_manager(config: Dict[str, str]) -> SessionManager:
    """
    Create session manager for session storage.

    Args:
        config: Authentication configuration

    Returns:
        Configured session manager

    Raises:
        Exception: If session manager creation fails
    """
    try:
        token_encryption = _create_token_encryption(config)
        return SessionManager(table_name=config["session_table_name"], encryption=token_encryption)
    except Exception as e:
        logger.error(f"Failed to create session manager: {e}")
        raise Exception("Configuration error: Unable to initialize session management")


def _create_otac_manager(config: Dict[str, str]) -> OTACManager:
    """
    Create OTAC manager for cross-domain synchronization.

    Args:
        config: Authentication configuration

    Returns:
        Configured OTAC manager

    Raises:
        Exception: If OTAC manager creation fails
    """
    try:
        return OTACManager(table_name=config["session_table_name"])
    except Exception as e:
        logger.error(f"Failed to create OTAC manager: {e}")
        raise Exception("Configuration error: Unable to initialize OTAC management")


def _get_base_url(event: Dict) -> str:
    """
    Get base URL for building redirect URIs.

    Uses WEB_CUSTOM_DOMAIN_NAME if configured, otherwise falls back to Host header
    with stage path from requestContext.

    Args:
        event: Lambda event

    Returns:
        Base URL (e.g., "https://mlspace.example.com" or "https://api-id.execute-api.region.amazonaws.com/Prod")
    """
    # Check for custom domain configuration
    custom_domain = os.environ.get("WEB_CUSTOM_DOMAIN_NAME", "").strip()
    if custom_domain:
        # Remove trailing slash if present
        return custom_domain.rstrip("/")

    # Fall back to Host header with stage path
    host = event.get("headers", {}).get("Host") or event.get("headers", {}).get("host", "")

    # Determine protocol
    protocol = "https"
    if host.startswith("localhost") or "127.0.0.1" in host:
        protocol = "http"

    # Get stage from requestContext (API Gateway includes this)
    request_context = event.get("requestContext", {})
    stage = request_context.get("stage", "")

    # Build base URL with stage if present
    base_url = f"{protocol}://{host}"
    if stage:
        base_url = f"{base_url}/{stage}"

    return base_url


def _get_redirect_uri(event: Dict) -> str:
    """
    Build redirect URI for OIDC callback.

    Args:
        event: Lambda event

    Returns:
        Callback redirect URI
    """
    base_url = _get_base_url(event)
    return f"{base_url}/auth/callback"


def _get_root_path(event: Dict) -> str:
    """
    Get the root path for session cookie configuration.

    For custom domains, returns "/".
    For stage-based deployments, returns "/{stage}".

    Args:
        event: Lambda event

    Returns:
        Root path for session cookies (e.g., "/" or "/Prod")
    """
    # Check for custom domain configuration
    custom_domain = os.environ.get("WEB_CUSTOM_DOMAIN_NAME", "").strip()
    if custom_domain:
        # Custom domain doesn't include stage in path
        return "/"

    # Get stage from requestContext (API Gateway includes this)
    request_context = event.get("requestContext", {})
    stage = request_context.get("stage", "")

    # Build root path with stage if present
    if stage:
        return f"/{stage}"

    return "/"


def _get_auth_path(event: Dict) -> str:
    """
    Get the auth path for state cookie configuration.

    For custom domains, returns "/auth".
    For stage-based deployments, returns "/{stage}/auth".

    Args:
        event: Lambda event

    Returns:
        Auth path for state cookies (e.g., "/auth" or "/Prod/auth")
    """
    # Check for custom domain configuration
    custom_domain = os.environ.get("WEB_CUSTOM_DOMAIN_NAME", "").strip()
    if custom_domain:
        # Custom domain doesn't include stage in path
        return "/auth"

    # Get stage from requestContext (API Gateway includes this)
    request_context = event.get("requestContext", {})
    stage = request_context.get("stage", "")

    # Build auth path with stage if present
    if stage:
        return f"/{stage}/auth"

    return "/auth"


def _validate_redirect_url(redirect_url: str, host_header: str) -> bool:
    """
    Validate that redirect URL is safe and belongs to the same origin.

    Args:
        redirect_url: URL to validate
        host_header: Host header from request

    Returns:
        True if redirect URL is valid, False otherwise
    """
    if not redirect_url:
        return False
    
    if redirect_url == "http://localhost:3000/Prod":
        return True

    try:
        parsed = urlparse(redirect_url)

        # Allow relative URLs
        if not parsed.netloc:
            return redirect_url.startswith("/") and not redirect_url.startswith("//")

        # For absolute URLs, check that host matches
        return parsed.netloc.lower() == host_header.lower()
    except Exception:
        return False


def login(event, context):
    """
    Handle GET /auth/login - Initiate authentication flow.

    Generates state parameter, sets state cookie, and redirects to IdP.

    Args:
        event: Lambda event containing request data
        context: Lambda context

    Returns:
        Redirect response to IdP authorization endpoint
    """
    try:
        # Get authentication configuration
        config = _get_auth_config()

        # Create authentication handler
        auth_handler = _create_auth_handler(config)

        # Create state manager
        state_manager = _create_state_manager(config)

        # Get redirect URL from query parameters
        query_params = event.get("queryStringParameters") or {}
        root_path = _get_root_path(event)
        redirect_url = query_params.get("redirectUrl", root_path)
        host_header = event.get("headers", {}).get("Host") or event.get("headers", {}).get("host", "")
        logger.info(f"DEBUG redirect_url: {redirect_url}")
        logger.info(f"DEBUG host_header: {host_header}")

        # Validate redirect URL
        # if not _validate_redirect_url(redirect_url, host_header):
        #     logger.warning(f"Invalid redirect URL: {redirect_url}")
        #     redirect_url = root_path

        # Get domain for state and cookies
        domain = extract_domain_from_host(host_header)

        # Generate nonce for state parameter
        nonce = state_manager.generate_nonce()

        # Generate protocol-specific data for OIDC (PKCE code_verifier if enabled)
        protocol_data = None
        if config["oidc_use_pkce"]:
            protocol_data = {"code_verifier": generate_token(48)}

        # Create encrypted state parameter with protocol-specific data
        encrypted_state = state_manager.create_state(
            redirect_url=redirect_url, domain=domain or host_header, nonce=nonce, protocol_data=protocol_data
        )

        # Get redirect URI for OIDC callback
        redirect_uri = _get_redirect_uri(event)

        # Generate authorization URL with code_verifier if PKCE is enabled
        code_verifier = protocol_data.get("code_verifier") if protocol_data else None
        authorization_url = auth_handler.get_authorization_url(
            state=encrypted_state, redirect_uri=redirect_uri, code_verifier=code_verifier
        )

        # Create state cookie
        secure_flag = should_set_secure_flag(host_header)
        auth_path = _get_auth_path(event)
        state_cookie = create_state_cookie(
            nonce=nonce, max_age_seconds=600, secure=secure_flag, same_site="None", path=auth_path
        )  # 10 minutes

        logger.info(f"Login initiated for domain: {domain}, redirecting to IdP")

        # Return redirect response with state cookie
        return create_redirect_response(location=authorization_url, cookies=[state_cookie], status_code=302)

    except Exception as e:
        logger.error(f"Login failed: {e}")

        # Return error response
        error_message = str(e)
        is_config_error = (
            "environment variable is required" in error_message
            or "Configuration error" in error_message
            or "not configured" in error_message
            or "Failed to discover OIDC endpoints" in error_message
            or "Invalid URL" in error_message
            or "No scheme supplied" in error_message
            or "Unsupported IdP type" in error_message
        )

        error_response = {
            "error": AuthError.INVALID_CONFIGURATION if is_config_error else AuthError.INTERNAL_ERROR,
            "message": error_message,
            "timestamp": context.aws_request_id if context else None,
        }

        return create_json_response(body=error_response, status_code=400 if is_config_error else 500)


def _validate_callback_parameters(event):
    """
    Validate callback parameters and handle early error cases.

    Args:
        event: Lambda event containing callback data

    Returns:
        Tuple of (auth_code, encrypted_state, error_response)
        If error_response is not None, should return it immediately
    """
    query_params = event.get("queryStringParameters") or {}
    auth_code = query_params.get("code")
    encrypted_state = query_params.get("state")
    error_param = query_params.get("error")
    error_description = query_params.get("error_description", "")
    root_path = _get_root_path(event)

    # Check for IdP error response
    if error_param:
        logger.warning(f"IdP returned error: {error_param} - {error_description}")
        error_url = f"{root_path}?error=authentication_failed&message={error_param}"
        return None, None, create_redirect_response(location=error_url, status_code=302)

    # Validate required parameters
    if not auth_code or not encrypted_state:
        logger.warning("Missing required callback parameters")
        error_url = f"{root_path}?error=invalid_request&message=Missing required parameters"
        return None, None, create_redirect_response(location=error_url, status_code=302)

    return auth_code, encrypted_state, None


def _validate_state_parameter(event, state_manager, encrypted_state):
    """
    Validate state parameter against state cookie.

    Args:
        event: Lambda event containing headers
        state_manager: StateManager instance
        encrypted_state: Encrypted state from query parameters

    Returns:
        Tuple of (state_data, error_response)
        If error_response is not None, should return it immediately
    """
    # Extract state cookie
    cookie_header = event.get("headers", {}).get("Cookie") or event.get("headers", {}).get("cookie", "")
    state_nonce = get_cookie_value(cookie_header, "mlspace_auth_state")
    root_path = _get_root_path(event)

    # Validate state parameter
    state_data = state_manager.validate_state(encrypted_state, state_nonce)
    if not state_data:
        logger.warning("Invalid or expired state parameter")
        error_url = f"{root_path}?error=invalid_state&message=Authentication request expired or invalid"
        return None, create_redirect_response(location=error_url, status_code=302)

    return state_data, None


def _exchange_code_for_tokens(auth_handler, auth_code, state_data, event):
    """
    Exchange authorization code for tokens via OIDC handler.

    Args:
        auth_handler: OIDC handler instance
        auth_code: Authorization code from callback
        state_data: Validated state data containing protocol_data if present
        event: Lambda event for building redirect URI

    Returns:
        Tuple of (auth_result, error_response)
        If error_response is not None, should return it immediately
    """
    # Get redirect URI for token exchange
    redirect_uri = _get_redirect_uri(event)
    root_path = _get_root_path(event)

    # Extract code_verifier from protocol_data if present (for PKCE flow)
    protocol_data = state_data.get("protocol_data", {})
    code_verifier = protocol_data.get("code_verifier")

    # Exchange authorization code for tokens
    auth_result = auth_handler.handle_callback(code=auth_code, redirect_uri=redirect_uri, code_verifier=code_verifier)

    if not auth_result.success:
        logger.error(f"Token exchange failed: {auth_result.error}")
        error_url = f"{root_path}?error=token_exchange_failed&message={auth_result.error}"
        return None, create_redirect_response(location=error_url, status_code=302)

    return auth_result, None


def _ensure_user_exists(user_data: UserData) -> None:
    """
    Ensure user exists in the system, creating or updating as needed.

    Creates users with username and display_name matching the pattern from the frontend
    (oidc.config.ts onSigninCallback). Updates existing users to backfill the id field
    from the IdP's "sub" claim.

    Args:
        user_data: User data from authentication result
    """
    user_dao = UserDAO()

    # Extract the sub claim from attributes (stored by normalize_user_data)
    idp_sub = user_data.attributes.get("sub", "")

    # Check if user already exists
    existing_user = user_dao.get(user_data.id)

    if existing_user:
        # Update existing user: set last login and backfill id field if missing
        existing_user.last_login = int(time.time())

        # Backfill the id field with the IdP's sub claim if not already set
        if not existing_user.id and idp_sub:
            existing_user.id = idp_sub
            logger.info(f"Backfilled id field for existing user: {user_data.id}")

        user_dao.update(user_data.id, existing_user)
        logger.info(f"Updated last login for existing user: {user_data.id}")
    else:
        # Create new user matching the frontend pattern:
        # - username: sanitized preferred_username (user_data.id)
        # - display_name: name claim or constructed name (user_data.displayName)
        # - email: email claim
        # - id: sub claim from IdP
        env_vars = get_environment_variables()
        suspended_state = env_vars.get("NEW_USERS_SUSPENDED") == "True"
        preferences = {TIMEZONE_PREFERENCE_KEY: TimezonePreference.LOCAL}

        new_user = UserModel(
            username=user_data.id,  # Sanitized preferred_username
            email=user_data.email or "",
            display_name=user_data.displayName,  # Name claim, matching frontend
            suspended=suspended_state,
            preferences=preferences,
            id=idp_sub if idp_sub else None,  # IdP's sub claim
        )
        user_dao.create(new_user)
        logger.info(f"Created new user: {user_data.id} with IdP id: {idp_sub}")


def _create_user_session(session_manager, auth_result, auth_handler, config, event):
    """
    Create session record in DynamoDB with encrypted tokens and ensure user exists.

    Args:
        session_manager: SessionManager instance
        auth_result: Authentication result from OIDC handler
        auth_handler: OIDC handler for token expiration calculation
        config: Authentication configuration
        event: Lambda event for domain extraction

    Returns:
        Tuple of (session_id, expires_at, login_domain)
    """
    # Ensure user exists in the system (create or update)
    _ensure_user_exists(auth_result.user_data)

    # Calculate session expiration times
    access_expires, refresh_expires = auth_handler.extract_token_expiration(auth_result.tokens)

    # Session expires when refresh token expires (or default to 24 hours if no refresh token)
    if not refresh_expires:
        refresh_expires = 60 * 60 * 24

    expires_at = datetime.now(timezone.utc) + timedelta(seconds=refresh_expires)

    # Refresh at access token expiration to keep user info fresh, but not later than 5 minutes before session expires
    access_token_expiration = datetime.now(timezone.utc) + timedelta(seconds=access_expires)
    five_minutes_before_expiry = expires_at - timedelta(minutes=5)

    # Use the earlier of the two times
    refresh_at = min(access_token_expiration, five_minutes_before_expiry)

    # Create session record
    login_domain = extract_domain_from_host(event.get("headers", {}).get("Host", ""))

    session_id = session_manager.create_session(
        user_data=auth_result.user_data.model_dump(),
        tokens=auth_result.tokens.model_dump(),
        provider=config["idp_type"],
        expires_at=expires_at,
        refresh_at=refresh_at,
        login_domain=login_domain or "",
        synced_domains=[],
        raw_idp_response=auth_result.raw_response,
    )

    return session_id, refresh_expires, login_domain


def _handle_multi_domain_sync(otac_manager, session_id, config, event, state_data, session_cookie, clear_state):
    """
    Handle multi-domain cookie synchronization if configured.

    Args:
        otac_manager: OTACManager instance
        session_id: Created session ID
        config: Authentication configuration
        event: Lambda event for domain extraction
        state_data: Validated state data containing redirect URL
        session_cookie: Session cookie to set
        clear_state: State cookie clearing header

    Returns:
        Tuple of (should_sync, redirect_response)
        If should_sync is True, redirect_response contains the sync chain URL
    """
    host_header = event.get("headers", {}).get("Host") or event.get("headers", {}).get("host", "")
    domain = extract_domain_from_host(host_header)

    # Check for multi-domain synchronization
    sync_domains = build_domain_list(domain or host_header, config.get("sync_domains", ""))

    if should_initiate_sync(sync_domains):
        # Create OTAC for cross-domain sync
        otac_id = otac_manager.create_otac(
            session_id=session_id, remaining_domains=sync_domains, final_redirect_url=state_data["redirect_url"]
        )

        # Build sync chain URL
        sync_url = build_sync_chain_url(
            current_domain=domain or host_header,
            otac=otac_id,
            remaining_domains=sync_domains,
            final_redirect_url=state_data["redirect_url"],
        )

        logger.info(f"Initiating multi-domain sync for {len(sync_domains)} domains")

        return True, create_redirect_response(location=sync_url, cookies=[session_cookie, clear_state], status_code=302)

    return False, None


def callback(event, context):
    """
    Handle GET /auth/callback - Process IdP callback after authentication.

    Validates state parameter, exchanges authorization code for tokens,
    creates session, and handles multi-domain synchronization.

    Args:
        event: Lambda event containing callback data
        context: Lambda context

    Returns:
        Redirect response to final destination or error page
    """
    try:
        # Validate callback parameters and handle early errors
        auth_code, encrypted_state, error_response = _validate_callback_parameters(event)
        if error_response:
            return error_response

        # Get authentication configuration and create managers
        config = _get_auth_config()
        auth_handler = _create_auth_handler(config)
        state_manager = _create_state_manager(config)
        session_manager = _create_session_manager(config)
        otac_manager = _create_otac_manager(config)

        # Validate state parameter
        state_data, error_response = _validate_state_parameter(event, state_manager, encrypted_state)
        if error_response:
            return error_response

        # Exchange authorization code for tokens
        auth_result, error_response = _exchange_code_for_tokens(auth_handler, auth_code, state_data, event)
        if error_response:
            return error_response

        # Create session record
        session_id, expires_at, login_domain = _create_user_session(session_manager, auth_result, auth_handler, config, event)

        # Create session cookie
        host_header = event.get("headers", {}).get("Host") or event.get("headers", {}).get("host", "")
        secure_flag = should_set_secure_flag(host_header)
        domain = extract_domain_from_host(host_header)
        root_path = _get_root_path(event)

        session_cookie = create_session_cookie(
            session_id=session_id, max_age_seconds=int(expires_at), domain=domain, secure=secure_flag, path=root_path
        )

        # Clear state cookie
        auth_path = _get_auth_path(event)
        clear_state = clear_state_cookie(path=auth_path)

        # Handle multi-domain synchronization
        should_sync, sync_response = _handle_multi_domain_sync(
            otac_manager, session_id, config, event, state_data, session_cookie, clear_state
        )

        if should_sync:
            return sync_response

        # Single domain, redirect to final destination
        logger.info(f"Authentication successful for user: {auth_result.user_data.id}")
        return create_redirect_response(
            location=state_data["redirect_url"], cookies=[session_cookie, clear_state], status_code=302
        )

    except Exception as e:
        logger.error(f"Callback processing failed: {e}")

        # Clear state cookie on error
        auth_path = _get_auth_path(event)
        root_path = _get_root_path(event)
        clear_state = clear_state_cookie(path=auth_path)
        error_url = f"{root_path}?error=internal_error&message=Authentication processing failed"

        return create_redirect_response(location=error_url, cookies=[clear_state], status_code=302)


def callback_post(event, context):
    """
    Handle POST /auth/callback - Process IdP callback for SAML and other POST-based flows.

    This handler supports future IdP integrations that use POST callbacks
    (such as SAML assertions) instead of GET redirects.

    Args:
        event: Lambda event containing POST callback data
        context: Lambda context

    Returns:
        Redirect response to final destination or error page
    """
    try:
        # Get authentication configuration
        config = _get_auth_config()
        root_path = _get_root_path(event)

        # Currently only OIDC is supported, which uses GET callbacks
        if config["idp_type"] != IdPType.SAML:
            logger.warning(f"POST callback not supported for IdP type: {config['idp_type']}")
            error_url = f"{root_path}?error=unsupported_callback&message=POST callback not supported for this IdP type"
            return create_redirect_response(location=error_url, status_code=302)

        # TODO: Implement SAML POST callback handling
        # This would involve:
        # 1. Parse SAML assertion from POST body
        # 2. Validate SAML signature and assertions
        # 3. Extract user data from SAML attributes
        # 4. Create session (similar to OIDC callback)
        # 5. Handle multi-domain sync if configured

        logger.error("SAML POST callback not yet implemented")
        error_url = f"{root_path}?error=not_implemented&message=SAML authentication not yet supported"
        return create_redirect_response(location=error_url, status_code=302)

    except Exception as e:
        logger.error(f"POST callback processing failed: {e}")
        root_path = _get_root_path(event)
        error_url = f"{root_path}?error=internal_error&message=Authentication processing failed"
        return create_redirect_response(location=error_url, status_code=302)


def _parse_logout_request(event) -> Tuple[Optional[str], bool]:
    """
    Parse logout request to extract session ID and logout options.

    Args:
        event: Lambda event containing logout request

    Returns:
        Tuple of (session_id, logout_from_idp)
    """
    # Extract session cookie
    cookie_header = event.get("headers", {}).get("Cookie") or event.get("headers", {}).get("cookie", "")
    session_id = get_cookie_value(cookie_header, "mlspace_session")

    # Parse request body for logout options
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except json.JSONDecodeError:
            logger.warning("Invalid JSON in logout request body")

    logout_from_idp = body.get("logoutFromIdp", False)
    return session_id, logout_from_idp


def _validate_logout_session(session_id: str, session_manager: SessionManager) -> Optional[Dict]:
    """
    Validate session exists and is active for logout.

    Args:
        session_id: Session identifier to validate
        session_manager: Session manager instance

    Returns:
        Session data if valid, None otherwise
    """
    session_data = session_manager.get_session(session_id)
    if not session_data:
        logger.warning(f"Invalid or expired session in logout request: {session_id}")
        return None

    return session_data


def _delete_user_session(session_id: str, session_manager: SessionManager) -> bool:
    """
    Delete session record from storage.

    Args:
        session_id: Session identifier to delete
        session_manager: Session manager instance

    Returns:
        True if deletion successful, False otherwise
    """
    deletion_success = session_manager.delete_session(session_id)
    if not deletion_success:
        logger.error(f"Failed to delete session: {session_id}")
    return deletion_success


def _get_idp_logout_url(config: Dict[str, str], event: Dict) -> Optional[str]:
    """
    Generate IdP logout URL for single sign-out.

    Args:
        config: Authentication configuration
        event: Lambda event for building base URL

    Returns:
        IdP logout URL if available, None otherwise
    """
    try:
        # Create authentication handler to get logout URL
        auth_handler = _create_auth_handler(config)

        # Build post-logout redirect URI (back to login page)
        base_url = _get_base_url(event)
        post_logout_redirect_uri = f"{base_url}/"

        idp_logout_url = auth_handler.get_logout_url(post_logout_redirect_uri)

        if idp_logout_url:
            logger.info("IdP logout URL generated for single sign-out")
        else:
            logger.info("IdP does not support logout endpoint")

        return idp_logout_url

    except Exception as e:
        logger.warning(f"Failed to get IdP logout URL: {e}")
        return None


def _create_logout_error_response(context, event) -> Dict:
    """
    Create error response for logout failures with session cookie cleanup.

    Args:
        context: Lambda context
        event: Lambda event for cookie domain extraction

    Returns:
        Error response dictionary with cookies
    """
    # Try to clear session cookie even on error
    try:
        host_header = event.get("headers", {}).get("Host") or event.get("headers", {}).get("host", "")
        domain = extract_domain_from_host(host_header)
        root_path = _get_root_path(event)
        clear_session = clear_session_cookie(domain=domain, path=root_path)
        cookies = [clear_session]
    except Exception:
        cookies = None

    error_response = {
        "error": AuthError.INTERNAL_ERROR,
        "message": "Logout processing failed",
        "timestamp": context.aws_request_id if context else None,
    }

    return create_json_response(body=error_response, status_code=500, cookies=cookies)


def logout(event, context):
    """
    Handle POST /auth/logout - Terminate user session and optionally logout from IdP.

    Validates session cookie, deletes session record from DynamoDB,
    clears session cookie, and optionally redirects to IdP logout endpoint.

    Args:
        event: Lambda event containing logout request
        context: Lambda context

    Returns:
        JSON response with logout status and optional IdP logout URL
    """
    try:
        # Parse logout request
        session_id, logout_from_idp = _parse_logout_request(event)

        # Validate session exists first (before getting config)
        if not session_id:
            return create_json_response(
                body={"error": AuthError.INVALID_SESSION, "message": "No active session found"}, status_code=400
            )

        # Get authentication configuration and session manager
        config = _get_auth_config()
        session_manager = _create_session_manager(config)

        # Validate session exists in storage
        session_data = _validate_logout_session(session_id, session_manager)
        if not session_data:
            return create_json_response(
                body={"error": AuthError.INVALID_SESSION, "message": "No active session found"}, status_code=400
            )

        # Delete session record
        _delete_user_session(session_id, session_manager)

        # Get host header and clear session cookie
        host_header = event.get("headers", {}).get("Host") or event.get("headers", {}).get("host", "")
        domain = extract_domain_from_host(host_header)
        root_path = _get_root_path(event)
        clear_session = clear_session_cookie(domain=domain, path=root_path)

        # Prepare response
        response_body = {"status": "LOGGED_OUT"}

        # Get IdP logout URL if requested
        if logout_from_idp:
            idp_logout_url = _get_idp_logout_url(config, event)
            if idp_logout_url:
                response_body["idpLogoutUrl"] = idp_logout_url

        logger.info(f"User logout successful for session: {session_id}")

        # Return success response with cleared session cookie
        return create_json_response(body=response_body, status_code=200, cookies=[clear_session])

    except Exception as e:
        logger.error(f"Logout processing failed: {e}")
        return _create_logout_error_response(context, event)


def _validate_session_cookie(event) -> Optional[str]:
    """
    Extract and validate session cookie from request.

    Args:
        event: Lambda event containing headers

    Returns:
        Session ID if valid cookie found, None otherwise
    """
    cookie_header = event.get("headers", {}).get("Cookie") or event.get("headers", {}).get("cookie", "")
    return get_cookie_value(cookie_header, "mlspace_session")


def _check_token_refresh_needed(session_info: Dict) -> bool:
    """
    Check if token refresh is needed based on refreshAt timestamp.

    Args:
        session_info: Session information dictionary

    Returns:
        True if refresh is needed, False otherwise
    """
    refresh_at_str = session_info.get("refreshAt")
    if not refresh_at_str:
        return False

    try:
        refresh_at = datetime.fromisoformat(refresh_at_str)
        now = datetime.now(timezone.utc)
        return now >= refresh_at
    except ValueError:
        logger.warning(f"Invalid refreshAt timestamp in session: {refresh_at_str}")
        return False


def _attempt_token_refresh(
    session_id: str, session_info: Dict, config: Dict, session_manager: SessionManager, event: Dict
) -> Tuple[bool, Optional[str], Dict]:
    """
    Attempt to refresh tokens if refresh token is available.

    Args:
        session_id: Session identifier
        session_info: Current session information
        config: Authentication configuration
        session_manager: Session manager instance
        event: Lambda event for cookie creation

    Returns:
        Tuple of (refreshed, new_session_cookie, updated_session_info)
    """
    refresh_token = session_info.get("refresh_token")
    if not refresh_token:
        logger.info(f"No refresh token available for session: {session_id}")
        return False, None, session_info

    try:
        # Create authentication handler for token refresh
        auth_handler = _create_auth_handler(config)

        # Attempt token refresh
        refresh_result = auth_handler.refresh_tokens(refresh_token)

        if not refresh_result.success:
            logger.warning(f"Token refresh failed for session {session_id}: {refresh_result.error}")
            return False, None, session_info

        # Calculate new expiration times
        access_expires, refresh_expires = auth_handler.extract_token_expiration(refresh_result.tokens)

        # Session expires when refresh token expires (or default to 24 hours if no refresh token)
        if refresh_expires:
            new_expires_at = datetime.now(timezone.utc) + timedelta(seconds=refresh_expires)
        else:
            # Default to 24 hours if no refresh token expiration provided
            new_expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

        # Refresh at access token expiration to keep user info fresh, but not later than 5 minutes before session expires
        access_token_expiration = datetime.now(timezone.utc) + timedelta(seconds=access_expires)
        five_minutes_before_expiry = new_expires_at - timedelta(minutes=5)

        # Use the earlier of the two times
        new_refresh_at = min(access_token_expiration, five_minutes_before_expiry)

        # Update session with new tokens and user data
        update_success = session_manager.refresh_session_with_user_data(
            session_id=session_id,
            tokens=refresh_result.tokens.model_dump(),
            user_data=refresh_result.user_data.model_dump(),
            expires_at=new_expires_at,
            refresh_at=new_refresh_at,
            raw_idp_response=refresh_result.raw_response,
        )

        if not update_success:
            logger.error(f"Failed to update session after token refresh: {session_id}")
            return False, None, session_info

        # Update session info for response
        updated_session_info = session_info.copy()
        updated_session_info.update(
            {
                "expiresAt": new_expires_at.isoformat(),
                "refreshAt": new_refresh_at.isoformat(),
                "provider": session_info.get("provider", config["idp_type"]),
            }
        )

        # Create new session cookie with updated expiration
        host_header = event.get("headers", {}).get("Host") or event.get("headers", {}).get("host", "")
        secure_flag = should_set_secure_flag(host_header)
        domain = extract_domain_from_host(host_header)
        root_path = _get_root_path(event)

        new_session_cookie = create_session_cookie(
            session_id=session_id, max_age_seconds=int(access_expires), domain=domain, secure=secure_flag, path=root_path
        )

        logger.info(f"Token refresh successful for session: {session_id}")
        return True, new_session_cookie, updated_session_info

    except Exception as e:
        logger.error(f"Token refresh attempt failed for session {session_id}: {e}")
        return False, None, session_info


def _create_identity_response(user_data: Dict, session_info: Dict, config: Dict, refreshed: bool = False) -> IdentityResponse:
    """
    Create identity response from session data.

    Args:
        user_data: User information dictionary
        session_info: Session information dictionary
        config: Authentication configuration
        refreshed: Whether tokens were refreshed

    Returns:
        IdentityResponse model
    """
    user = UserData(
        id=user_data.get("id", ""),
        displayName=user_data.get("displayName", ""),
        email=user_data.get("email", ""),
        groups=user_data.get("groups", []),
        attributes=user_data.get("attributes", {}),
    )

    session = SessionInfo(
        expiresAt=session_info.get("expiresAt", ""),
        refreshAt=session_info.get("refreshAt", ""),
        provider=session_info.get("provider", config["idp_type"]),
        refreshed=refreshed if refreshed else None,
    )

    return IdentityResponse(status=AuthStatus.AUTHENTICATED, user=user, session=session)


def identity(event, context):
    """
    Handle GET /auth/identity - Retrieve current user identity and authentication status.

    Validates session cookie, retrieves session from DynamoDB, checks if token refresh
    is needed, attempts token refresh if needed, and returns user identity and session information.

    Args:
        event: Lambda event containing identity request
        context: Lambda context

    Returns:
        JSON response with user identity and session info, or 401 if unauthenticated
    """
    try:
        # Extract and validate session cookie
        session_id = _validate_session_cookie(event)
        if not session_id:
            logger.info("No session cookie found in identity request")
            response = IdentityResponse(
                status=AuthStatus.UNAUTHENTICATED, error=AuthError.NO_SESSION, message="No session cookie found"
            )
            return create_json_response(body=response.model_dump(exclude_none=True), status_code=401)

        # Get authentication configuration and session manager
        config = _get_auth_config()
        session_manager = _create_session_manager(config)

        # Retrieve session from DynamoDB
        session_data = session_manager.get_session(session_id)
        if not session_data:
            logger.info(f"Invalid or expired session in identity request: {session_id}")
            response = IdentityResponse(
                status=AuthStatus.UNAUTHENTICATED, error=AuthError.SESSION_EXPIRED, message="Session has expired or is invalid"
            )
            return create_json_response(body=response.model_dump(exclude_none=True), status_code=401)

        # Extract session information
        user_data = session_data.get("data", {}).get("user", {})
        session_info = session_data.get("data", {}).get("session", {})

        # Check if token refresh is needed and attempt refresh
        needs_refresh = _check_token_refresh_needed(session_info)
        refreshed = False
        new_session_cookie = None

        if needs_refresh:
            refreshed, new_session_cookie, session_info = _attempt_token_refresh(
                session_id, session_info, config, session_manager, event
            )
            # Update user_data if refresh was successful
            if refreshed:
                # Re-fetch session to get updated user data
                updated_session_data = session_manager.get_session(session_id)
                if updated_session_data:
                    user_data = updated_session_data.get("data", {}).get("user", user_data)
                    session_info = updated_session_data.get("data", {}).get("session", session_info)

        # Create and return response
        response = _create_identity_response(user_data, session_info, config, refreshed)

        logger.info(f"Identity request successful for user: {user_data.get('id', 'unknown')}")

        cookies = [new_session_cookie] if new_session_cookie else None
        return create_json_response(body=response.model_dump(exclude_none=True), status_code=200, cookies=cookies)

    except Exception as e:
        logger.error(f"Identity request processing failed: {e}")

        response = IdentityResponse(
            status=AuthStatus.UNAUTHENTICATED,
            error=AuthError.INTERNAL_ERROR,
            message="Failed to process identity request",
            timestamp=context.aws_request_id if context else None,
        )

        return create_json_response(body=response.model_dump(exclude_none=True), status_code=401)


def _validate_sync_parameters(event) -> Tuple[Optional[str], List[str], Optional[str], Optional[Dict]]:
    """
    Validate sync request parameters.

    Args:
        event: Lambda event containing sync request

    Returns:
        Tuple of (otac, remaining_domains, final_redirect_url, error_response)
        If error_response is not None, should return it immediately
    """
    from ml_space_lambda.auth.utils.otac import parse_sync_request, validate_otac_format

    query_params = event.get("queryStringParameters") or {}
    root_path = _get_root_path(event)

    # Parse sync parameters
    otac, remaining_domains, final_redirect_url = parse_sync_request(query_params)

    # Validate OTAC format
    if not otac or not validate_otac_format(otac):
        logger.warning("Invalid or missing OTAC in sync request")
        error_url = f"{root_path}?error=invalid_otac&message=Invalid or missing authentication code"
        return None, [], None, create_redirect_response(location=error_url, status_code=302)

    # Validate final redirect URL
    if not final_redirect_url:
        logger.warning("Missing final redirect URL in sync request")
        error_url = f"{root_path}?error=invalid_request&message=Missing final redirect URL"
        return None, [], None, create_redirect_response(location=error_url, status_code=302)

    return otac, remaining_domains, final_redirect_url, None


def _validate_requesting_domain(event, config) -> Tuple[Optional[str], Optional[Dict]]:
    """
    Validate that the requesting domain is allowed for sync operations.

    Args:
        event: Lambda event containing request headers
        config: Authentication configuration

    Returns:
        Tuple of (requesting_domain, error_response)
        If error_response is not None, should return it immediately
    """
    from ml_space_lambda.auth.utils.otac import build_domain_list, normalize_domain

    host_header = event.get("headers", {}).get("Host") or event.get("headers", {}).get("host", "")
    root_path = _get_root_path(event)

    if not host_header:
        logger.warning("Missing Host header in sync request")
        error_url = f"{root_path}?error=invalid_request&message=Invalid request"
        return None, create_redirect_response(location=error_url, status_code=302)

    requesting_domain = normalize_domain(host_header)

    # Build allowed domains list (primary + sync domains)
    primary_domain = normalize_domain(config.get("primary_domain", "") or host_header)
    sync_domains = build_domain_list(primary_domain, config.get("sync_domains", ""))
    allowed_domains = [primary_domain] + sync_domains

    # Validate requesting domain is in allowed list
    if requesting_domain not in allowed_domains:
        logger.warning(f"Unauthorized domain in sync request: {requesting_domain}")
        error_url = f"{root_path}?error=unauthorized_domain&message=Domain not authorized for sync"
        return None, create_redirect_response(location=error_url, status_code=302)

    return requesting_domain, None


def _validate_and_consume_otac(otac_manager, otac, event) -> Tuple[Optional[Dict], Optional[Dict]]:
    """
    Validate OTAC and mark it as used.

    Args:
        otac_manager: OTACManager instance
        otac: OTAC identifier to validate
        event: Lambda event for building error URLs

    Returns:
        Tuple of (otac_data, error_response)
        If error_response is not None, should return it immediately
    """
    otac_data = otac_manager.validate_and_consume_otac(otac)

    if not otac_data:
        logger.warning(f"Invalid or expired OTAC: {otac}")
        root_path = _get_root_path(event)
        error_url = f"{root_path}?error=invalid_otac&message=Authentication code is invalid or expired"
        return None, create_redirect_response(location=error_url, status_code=302)

    return otac_data, None


def _set_session_cookie_for_domain(session_id, event, config) -> str:
    """
    Create session cookie for the current domain.

    Args:
        session_id: Session identifier
        event: Lambda event for domain extraction
        config: Authentication configuration

    Returns:
        Session cookie header value
    """
    host_header = event.get("headers", {}).get("Host") or event.get("headers", {}).get("host", "")
    secure_flag = should_set_secure_flag(host_header)
    domain = extract_domain_from_host(host_header)
    root_path = _get_root_path(event)

    # Use default session TTL (24 hours) for sync cookies
    session_ttl = int(config.get("session_ttl_hours", "24")) * 3600

    return create_session_cookie(
        session_id=session_id, max_age_seconds=session_ttl, domain=domain, secure=secure_flag, same_site="None", path=root_path
    )


def _handle_sync_chain_continuation(
    otac_manager, otac_data, remaining_domains, event
) -> Tuple[bool, Optional[str], Optional[Dict]]:
    """
    Handle continuation of sync chain if more domains remain.

    Args:
        otac_manager: OTACManager instance
        otac_data: Current OTAC data
        remaining_domains: Domains remaining in sync chain
        event: Lambda event for domain extraction

    Returns:
        Tuple of (should_continue, next_otac, error_response)
        If should_continue is True, redirect to next domain
        If error_response is not None, should return it immediately
    """
    from ml_space_lambda.auth.utils.otac import build_sync_chain_url

    if not remaining_domains:
        # End of chain
        return False, None, None

    try:
        # Create new OTAC for next domain in chain
        next_otac = otac_manager.create_otac(
            session_id=otac_data["sessionId"],
            remaining_domains=remaining_domains[1:],  # Remove first domain from remaining list
            final_redirect_url=otac_data["finalRedirectUrl"],
        )

        # Build sync chain URL for next domain
        host_header = event.get("headers", {}).get("Host") or event.get("headers", {}).get("host", "")
        current_domain = extract_domain_from_host(host_header) or host_header

        next_sync_url = build_sync_chain_url(
            current_domain=current_domain,
            otac=next_otac,
            remaining_domains=remaining_domains,
            final_redirect_url=otac_data["finalRedirectUrl"],
        )

        logger.info(f"Continuing sync chain to next domain: {remaining_domains[0]}")
        return True, next_sync_url, None

    except Exception as e:
        logger.error(f"Failed to create OTAC for sync chain continuation: {e}")
        root_path = _get_root_path(event)
        error_url = f"{root_path}?error=sync_failed&message=Failed to continue synchronization"
        return False, None, create_redirect_response(location=error_url, status_code=302)


def sync(event, context):
    """
    Handle GET /auth/sync - Cross-domain cookie synchronization.

    Validates OTAC with strong consistency read from DynamoDB, marks OTAC as used,
    retrieves session ID from OTAC record, sets session cookie for current domain,
    generates new OTAC for next domain in chain if applicable, and redirects to
    next domain or final destination.

    Args:
        event: Lambda event containing sync request
        context: Lambda context

    Returns:
        Redirect response to next domain in chain or final destination
    """
    try:
        # Validate sync request parameters
        otac, remaining_domains, final_redirect_url, error_response = _validate_sync_parameters(event)
        if error_response:
            return error_response

        # Get authentication configuration and create managers
        config = _get_auth_config()
        otac_manager = _create_otac_manager(config)

        # Validate requesting domain is authorized
        requesting_domain, error_response = _validate_requesting_domain(event, config)
        if error_response:
            return error_response

        # Validate OTAC and mark as used (strong consistency)
        otac_data, error_response = _validate_and_consume_otac(otac_manager, otac, event)
        if error_response:
            return error_response

        # Extract session ID from OTAC
        session_id = otac_data["sessionId"]

        # Create session cookie for current domain
        session_cookie = _set_session_cookie_for_domain(session_id, event, config)

        # Check if sync chain should continue
        should_continue, next_sync_url, error_response = _handle_sync_chain_continuation(
            otac_manager, otac_data, remaining_domains, event
        )

        if error_response:
            return error_response

        if should_continue:
            # Continue sync chain to next domain
            logger.info(f"Cross-domain sync successful for domain: {requesting_domain}, continuing chain")
            return create_redirect_response(location=next_sync_url, cookies=[session_cookie], status_code=302)
        else:
            # End of chain, redirect to final destination
            logger.info(f"Cross-domain sync chain completed for domain: {requesting_domain}")
            return create_redirect_response(location=otac_data["finalRedirectUrl"], cookies=[session_cookie], status_code=302)

    except Exception as e:
        logger.error(f"Sync processing failed: {e}")

        # Return error redirect
        root_path = _get_root_path(event)
        error_url = f"{root_path}?error=sync_failed&message=Cross-domain synchronization failed"
        return create_redirect_response(location=error_url, status_code=302)
