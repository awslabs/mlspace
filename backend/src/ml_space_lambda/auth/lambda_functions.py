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
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, Tuple
from urllib.parse import urlparse

import boto3

from ml_space_lambda.auth.handlers.base_handler import AuthError, AuthStatus, IdentityResponse, SessionInfo, UserData
from ml_space_lambda.auth.handlers.oidc_handler import OIDCConfig, OIDCHandler
from ml_space_lambda.auth.session.encryption import TokenEncryption, decode_key_from_storage
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

logger = logging.getLogger(__name__)

# Initialize AWS clients
ssm_client = boto3.client("ssm")


def _get_auth_config() -> Dict[str, str]:
    """
    Get authentication configuration from environment variables.

    Returns:
        Dictionary of authentication configuration

    Raises:
        Exception: If required configuration is missing or invalid
    """
    config = {
        "idp_type": os.environ.get("AUTH_IDP_TYPE", "oidc"),
        "oidc_url": os.environ.get("AUTH_OIDC_URL", ""),
        "oidc_client_id": os.environ.get("AUTH_OIDC_CLIENT_ID", ""),
        "oidc_client_secret_param": os.environ.get("AUTH_OIDC_CLIENT_SECRET_SSM_PARAM", ""),
        "oidc_verify_ssl": os.environ.get("AUTH_OIDC_VERIFY_SSL", "true").lower() == "true",
        "state_encryption_key_param": os.environ.get("AUTH_STATE_ENCRYPTION_KEY_SSM_PARAM", ""),
        "token_encryption_key_param": os.environ.get("AUTH_TOKEN_ENCRYPTION_KEY_SSM_PARAM", ""),
        "session_table_name": os.environ.get("AUTH_SESSION_TABLE_NAME", ""),
        "primary_domain": os.environ.get("AUTH_PRIMARY_DOMAIN", ""),
        "sync_domains": os.environ.get("AUTH_SYNC_DOMAINS", ""),
    }

    # Validate IdP type first
    if config["idp_type"] != "oidc":
        raise Exception(f"Unsupported IdP type: {config['idp_type']}. Only 'oidc' is currently supported.")

    # Validate required configuration for OIDC
    if not config["oidc_url"]:
        raise Exception("AUTH_OIDC_URL environment variable is required")

    if not config["oidc_client_id"]:
        raise Exception("AUTH_OIDC_CLIENT_ID environment variable is required")

    if not config["state_encryption_key_param"]:
        raise Exception("AUTH_STATE_ENCRYPTION_KEY_SSM_PARAM environment variable is required")

    if not config["token_encryption_key_param"]:
        raise Exception("AUTH_TOKEN_ENCRYPTION_KEY_SSM_PARAM environment variable is required")

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
    if config["idp_type"] != "oidc":
        raise Exception(f"Unsupported IdP type: {config['idp_type']}. Only 'oidc' is currently supported.")

    # OIDC-specific handler creation
    # Get OIDC client secret if configured
    client_secret = None
    if config["oidc_client_secret_param"]:
        try:
            client_secret = _get_ssm_parameter(config["oidc_client_secret_param"])
        except Exception as e:
            logger.warning(f"Failed to retrieve OIDC client secret: {e}")
            # Continue without client secret (PKCE flow)

    # Create OIDC configuration
    oidc_config = OIDCConfig(
        issuer_url=config["oidc_url"],
        client_id=config["oidc_client_id"],
        client_secret=client_secret,
        scopes=["openid", "profile", "email"],
        use_pkce=None,  # Auto-detect based on client_secret presence
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
        # Get state encryption key from SSM
        encoded_key = _get_ssm_parameter(config["state_encryption_key_param"])
        encryption_key = decode_state_key_from_storage(encoded_key)

        return StateManager(encryption_key)
    except Exception as e:
        logger.error(f"Failed to create state manager: {e}")
        raise Exception("Configuration error: Unable to initialize state management")


def _create_token_encryption(config: Dict[str, str]) -> TokenEncryption:
    """
    Create token encryption instance for securing IdP tokens.

    Args:
        config: Authentication configuration

    Returns:
        Configured token encryption instance

    Raises:
        Exception: If token encryption creation fails
    """
    try:
        # Get token encryption key from SSM
        encoded_key = _get_ssm_parameter(config["token_encryption_key_param"])
        encryption_key = decode_key_from_storage(encoded_key)

        return TokenEncryption(encryption_key)
    except Exception as e:
        logger.error(f"Failed to create token encryption: {e}")
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


def _get_redirect_uri(event: Dict) -> str:
    """
    Build redirect URI for OIDC callback.

    Args:
        event: Lambda event

    Returns:
        Callback redirect URI
    """
    # Get host from headers
    host = event.get("headers", {}).get("Host") or event.get("headers", {}).get("host", "")

    # Determine protocol
    protocol = "https"
    if host.startswith("localhost") or "127.0.0.1" in host:
        protocol = "http"

    return f"{protocol}://{host}/auth/callback"


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
    Handle POST /auth/login - Initiate authentication flow.

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

        # Parse request body
        body = {}
        if event.get("body"):
            try:
                body = json.loads(event["body"])
            except json.JSONDecodeError:
                logger.warning("Invalid JSON in request body")

        # Get redirect URL from request
        redirect_url = body.get("redirectUrl", "/")
        host_header = event.get("headers", {}).get("Host") or event.get("headers", {}).get("host", "")

        # Validate redirect URL
        if not _validate_redirect_url(redirect_url, host_header):
            logger.warning(f"Invalid redirect URL: {redirect_url}")
            redirect_url = "/"

        # Get domain for state and cookies
        domain = extract_domain_from_host(host_header)

        # Generate nonce for state parameter
        nonce = state_manager.generate_nonce()

        # Create encrypted state parameter
        encrypted_state = state_manager.create_state(redirect_url=redirect_url, domain=domain or host_header, nonce=nonce)

        # Get redirect URI for OIDC callback
        redirect_uri = _get_redirect_uri(event)

        # Generate authorization URL
        authorization_url = auth_handler.get_authorization_url(state=encrypted_state, redirect_uri=redirect_uri)

        # Create state cookie
        secure_flag = should_set_secure_flag(host_header)
        state_cookie = create_state_cookie(nonce=nonce, max_age_seconds=600, secure=secure_flag)  # 10 minutes

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
            "error": "INVALID_CONFIGURATION" if is_config_error else "INTERNAL_ERROR",
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

    # Check for IdP error response
    if error_param:
        logger.warning(f"IdP returned error: {error_param} - {error_description}")
        error_url = f"/?error=authentication_failed&message={error_param}"
        return None, None, create_redirect_response(location=error_url, status_code=302)

    # Validate required parameters
    if not auth_code or not encrypted_state:
        logger.warning("Missing required callback parameters")
        error_url = "/?error=invalid_request&message=Missing required parameters"
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

    # Validate state parameter
    state_data = state_manager.validate_state(encrypted_state, state_nonce)
    if not state_data:
        logger.warning("Invalid or expired state parameter")
        error_url = "/?error=invalid_state&message=Authentication request expired or invalid"
        return None, create_redirect_response(location=error_url, status_code=302)

    return state_data, None


def _exchange_code_for_tokens(auth_handler, auth_code, encrypted_state, event):
    """
    Exchange authorization code for tokens via OIDC handler.

    Args:
        auth_handler: OIDC handler instance
        auth_code: Authorization code from callback
        encrypted_state: Encrypted state parameter
        event: Lambda event for building redirect URI

    Returns:
        Tuple of (auth_result, error_response)
        If error_response is not None, should return it immediately
    """
    # Get redirect URI for token exchange
    redirect_uri = _get_redirect_uri(event)

    # Exchange authorization code for tokens
    auth_result = auth_handler.handle_callback(
        callback_data={"code": auth_code, "state": encrypted_state}, redirect_uri=redirect_uri
    )

    if not auth_result.success:
        logger.error(f"Token exchange failed: {auth_result.error}")
        error_url = f"/?error=token_exchange_failed&message={auth_result.error}"
        return None, create_redirect_response(location=error_url, status_code=302)

    return auth_result, None


def _create_user_session(session_manager, auth_result, auth_handler, config, event):
    """
    Create session record in DynamoDB with encrypted tokens.

    Args:
        session_manager: SessionManager instance
        auth_result: Authentication result from OIDC handler
        auth_handler: OIDC handler for token expiration calculation
        config: Authentication configuration
        event: Lambda event for domain extraction

    Returns:
        Tuple of (session_id, expires_at, login_domain)
    """
    # Calculate session expiration times
    access_expires, refresh_expires = auth_handler.extract_token_expiration(auth_result.tokens)

    # Session expires when access token expires (with some buffer)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=access_expires)

    # Refresh tokens 5 minutes before expiration
    refresh_at = expires_at - timedelta(minutes=5)

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

    return session_id, access_expires, login_domain


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
        auth_result, error_response = _exchange_code_for_tokens(auth_handler, auth_code, encrypted_state, event)
        if error_response:
            return error_response

        # Create session record
        session_id, access_expires, login_domain = _create_user_session(
            session_manager, auth_result, auth_handler, config, event
        )

        # Create session cookie
        host_header = event.get("headers", {}).get("Host") or event.get("headers", {}).get("host", "")
        secure_flag = should_set_secure_flag(host_header)
        domain = extract_domain_from_host(host_header)

        session_cookie = create_session_cookie(
            session_id=session_id, max_age_seconds=int(access_expires), domain=domain, secure=secure_flag
        )

        # Clear state cookie
        clear_state = clear_state_cookie()

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
        clear_state = clear_state_cookie()
        error_url = "/?error=internal_error&message=Authentication processing failed"

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

        # Currently only OIDC is supported, which uses GET callbacks
        if config["idp_type"] != "saml":
            logger.warning(f"POST callback not supported for IdP type: {config['idp_type']}")
            error_url = "/?error=unsupported_callback&message=POST callback not supported for this IdP type"
            return create_redirect_response(location=error_url, status_code=302)

        # TODO: Implement SAML POST callback handling
        # This would involve:
        # 1. Parse SAML assertion from POST body
        # 2. Validate SAML signature and assertions
        # 3. Extract user data from SAML attributes
        # 4. Create session (similar to OIDC callback)
        # 5. Handle multi-domain sync if configured

        logger.error("SAML POST callback not yet implemented")
        error_url = "/?error=not_implemented&message=SAML authentication not yet supported"
        return create_redirect_response(location=error_url, status_code=302)

    except Exception as e:
        logger.error(f"POST callback processing failed: {e}")
        error_url = "/?error=internal_error&message=Authentication processing failed"
        return create_redirect_response(location=error_url, status_code=302)


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
        # Extract session cookie first
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

        # Validate session cookie
        if not session_id:
            logger.warning("No session cookie found in logout request")
            return create_json_response(
                body={"error": "INVALID_SESSION", "message": "No active session found"}, status_code=400
            )

        # Get authentication configuration
        config = _get_auth_config()

        # Create session manager
        session_manager = _create_session_manager(config)

        # Retrieve session to validate it exists
        session_data = session_manager.get_session(session_id)
        if not session_data:
            logger.warning(f"Invalid or expired session in logout request: {session_id}")
            return create_json_response(
                body={"error": "INVALID_SESSION", "message": "No active session found"}, status_code=400
            )

        # Delete session record from DynamoDB
        deletion_success = session_manager.delete_session(session_id)
        if not deletion_success:
            logger.error(f"Failed to delete session: {session_id}")
            # Continue with logout even if deletion fails

        # Get host header for cookie domain
        host_header = event.get("headers", {}).get("Host") or event.get("headers", {}).get("host", "")
        domain = extract_domain_from_host(host_header)

        # Clear session cookie
        clear_session = clear_session_cookie(domain=domain)

        # Prepare response
        response_body = {"status": "LOGGED_OUT"}

        # Get IdP logout URL if requested
        idp_logout_url = None
        if logout_from_idp:
            try:
                # Create authentication handler to get logout URL
                auth_handler = _create_auth_handler(config)

                # Build post-logout redirect URI (back to login page)
                protocol = "https"
                if host_header.startswith("localhost") or "127.0.0.1" in host_header:
                    protocol = "http"
                post_logout_redirect_uri = f"{protocol}://{host_header}/"

                idp_logout_url = auth_handler.get_logout_url(post_logout_redirect_uri)

                if idp_logout_url:
                    response_body["idpLogoutUrl"] = idp_logout_url
                    logger.info("IdP logout URL generated for single sign-out")
                else:
                    logger.info("IdP does not support logout endpoint")

            except Exception as e:
                logger.warning(f"Failed to get IdP logout URL: {e}")
                # Continue with logout even if IdP logout URL generation fails

        logger.info(f"User logout successful for session: {session_id}")

        # Return success response with cleared session cookie
        return create_json_response(body=response_body, status_code=200, cookies=[clear_session])

    except Exception as e:
        logger.error(f"Logout processing failed: {e}")

        # Try to clear session cookie even on error
        try:
            host_header = event.get("headers", {}).get("Host") or event.get("headers", {}).get("host", "")
            domain = extract_domain_from_host(host_header)
            clear_session = clear_session_cookie(domain=domain)
            cookies = [clear_session]
        except Exception:
            cookies = None

        error_response = {
            "error": "INTERNAL_ERROR",
            "message": "Logout processing failed",
            "timestamp": context.aws_request_id if context else None,
        }

        return create_json_response(body=error_response, status_code=500, cookies=cookies)


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
        new_expires_at = datetime.now(timezone.utc) + timedelta(seconds=access_expires)
        new_refresh_at = new_expires_at - timedelta(minutes=5)

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

        new_session_cookie = create_session_cookie(
            session_id=session_id, max_age_seconds=int(access_expires), domain=domain, secure=secure_flag
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
