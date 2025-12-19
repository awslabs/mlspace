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
from typing import Dict
from urllib.parse import urlparse

import boto3

from ml_space_lambda.auth.handlers.oidc_handler import OIDCConfig, OIDCHandler
from ml_space_lambda.auth.utils.cookies import (
    create_json_response,
    create_redirect_response,
    create_state_cookie,
    extract_domain_from_host,
    should_set_secure_flag,
)
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
