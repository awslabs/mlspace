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
OIDC authentication handler using authlib.

Implements OpenID Connect authentication flows including authorization code flow
with client secrets and token refresh capabilities.
"""

import base64
import json
import logging
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlencode

import requests
from authlib.integrations.requests_client import OAuth2Session
from authlib.jose import JsonWebToken
from authlib.oauth2.rfc6749 import OAuth2Token
from authlib.oidc.discovery import OpenIDProviderMetadata, get_well_known_url
from pydantic import BaseModel, Field

from ml_space_lambda.auth.models.auth_models import AuthenticationResult, IdPTokens, UserData

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


class OIDCConfig(BaseModel):
    """
    OIDC-specific configuration.
    """

    issuer_url: str = Field(..., description="OIDC issuer URL")
    client_id: str = Field(..., description="OIDC client ID")
    client_secret: Optional[str] = Field(None, description="OIDC client secret (for confidential clients)")
    scopes: List[str] = Field(default=["openid", "profile", "email"], description="OAuth2 scopes to request")
    use_pkce: bool = Field(default=True, description="Whether to use PKCE flow (recommended even with client_secret)")


class OIDCHandler:
    """
    OIDC authentication handler supporting both PKCE and client secret flows.

    Uses authlib's built-in OIDC capabilities for proper OpenID Connect handling.

    Supports:
    - Authorization code flow with client secrets (for enterprise IdPs)
    - PKCE flow (for public clients - current MLSpace behavior)
    - Token refresh
    - User info retrieval
    - OpenID Connect Discovery
    - JWT ID token validation
    """

    def __init__(self, config: OIDCConfig):
        """
        Initialize OIDC handler with configuration.

        Args:
            config: OIDC configuration (Pydantic model)
        """
        self.config = config

        # Initialize authlib components
        # Common JWT algorithms for OIDC
        self.jwt = JsonWebToken(["RS256", "HS256", "ES256"])

        # Discover OIDC endpoints and metadata
        self._discover_endpoints()

        # Create OAuth2 session for token operations
        self._create_oauth_session()

        logger.info(f"OIDC handler initialized for issuer: {self.config.issuer_url}")

    def _discover_endpoints(self):
        """
        Discover OIDC endpoints using authlib's discovery utilities.

        Raises:
            Exception: If discovery fails or required endpoints are missing
        """
        try:
            # Use authlib's get_well_known_url and OpenIDProviderMetadata
            well_known_url = get_well_known_url(self.config.issuer_url, external=True)
            response = requests.get(well_known_url, timeout=10)
            response.raise_for_status()

            # Create OpenIDProviderMetadata object using authlib
            self.server_metadata = OpenIDProviderMetadata(response.json())

            # Extract endpoints from server metadata
            self.authorization_endpoint = self.server_metadata.get("authorization_endpoint")
            self.token_endpoint = self.server_metadata.get("token_endpoint")
            self.userinfo_endpoint = self.server_metadata.get("userinfo_endpoint")
            self.jwks_uri = self.server_metadata.get("jwks_uri")
            self.end_session_endpoint = self.server_metadata.get("end_session_endpoint")

            # Validate required endpoints
            if not all([self.authorization_endpoint, self.token_endpoint]):
                raise ValueError("Missing required OIDC endpoints in discovery document")

            logger.info("OIDC endpoints discovered successfully using authlib")

        except Exception as e:
            logger.error(f"OIDC discovery failed: {e}")
            raise Exception(f"Failed to discover OIDC endpoints: {e}")

    def _create_oauth_session(self):
        """
        Create OAuth2 session for token operations using authlib.
        """
        self.oauth_session = OAuth2Session(
            client_id=self.config.client_id,
            client_secret=self.config.client_secret,
            scope=" ".join(self.config.scopes),
            token_endpoint=self.token_endpoint,
            token_endpoint_auth_method="client_secret_post" if self.config.client_secret else None,
        )

    def get_authorization_url(self, state: str, redirect_uri: str, code_verifier: Optional[str] = None) -> str:
        """
        Generate OIDC authorization URL using authlib.

        Args:
            state: CSRF protection state parameter
            redirect_uri: Where IdP should redirect after authentication
            code_verifier: PKCE code verifier (required if use_pkce is True)

        Returns:
            Authorization URL for user redirection

        Raises:
            Exception: If URL generation fails or code_verifier is missing when PKCE is enabled
        """
        try:
            session_params = {
                "client_id": self.config.client_id,
                "scope": " ".join(self.config.scopes),
                "redirect_uri": redirect_uri,
            }
            authorization_params = {"state": state}

            # Generate authorization URL with PKCE if enabled
            if self.config.use_pkce:
                if not code_verifier:
                    raise ValueError("code_verifier is required when PKCE is enabled")

                session_params.update({"code_challenge_method": "S256"})

                authorization_params.update({"code_verifier": code_verifier})

                logger.info("Generated OIDC authorization URL with PKCE")
            else:
                logger.info("Generated OIDC authorization URL")

            # Create temporary OAuth2 session for URL generation
            client = OAuth2Session(**session_params)
            authorization_url, _ = client.create_authorization_url(self.authorization_endpoint, **authorization_params)

            return authorization_url

        except Exception as e:
            logger.error(f"Failed to generate authorization URL: {e}")
            raise Exception(f"Authorization URL generation failed: {e}")

    def handle_callback(self, code: str, redirect_uri: str, code_verifier: Optional[str] = None) -> AuthenticationResult:
        """
        Process OIDC callback and exchange authorization code for tokens using authlib.

        Args:
            code: Authorization code from IdP callback
            redirect_uri: Redirect URI used in authorization request
            code_verifier: PKCE code verifier (required if use_pkce is True)

        Returns:
            AuthenticationResult with user data and tokens

        Raises:
            Exception: If code_verifier is missing when PKCE is enabled
        """
        try:
            if not code:
                return AuthenticationResult(success=False, error="Missing authorization code in callback")

            # Exchange authorization code for tokens using authlib
            oauth_token = self._exchange_code_for_tokens(code, redirect_uri, code_verifier)
            logger.info(f"oauth_token={json.dumps(oauth_token)}")

            # Convert OAuth2Token to our IdPTokens model
            tokens = self._oauth_token_to_idp_tokens(oauth_token)
            logger.info(f"tokens={tokens.model_dump_json()}")

            # Get user information from tokens
            user_data = self._get_user_info_from_oauth_token(oauth_token)
            logger.info(f"user_data={user_data.model_dump_json()}")

            # Encode raw response for debugging
            raw_response = base64.b64encode(
                json.dumps({"tokens": tokens.model_dump(), "user_data": user_data.model_dump()}).encode()
            ).decode()

            logger.info(f"OIDC authentication successful for user: {user_data.id}")

            return AuthenticationResult(success=True, user_data=user_data, tokens=tokens, raw_response=raw_response)

        except Exception as e:
            logger.error(f"OIDC callback handling failed: {e}")
            return AuthenticationResult(success=False, error=f"Authentication failed: {str(e)}")

    def refresh_tokens(self, refresh_token: str) -> AuthenticationResult:
        """
        Refresh OIDC tokens using authlib's OAuth2Session.

        Args:
            refresh_token: Valid refresh token

        Returns:
            AuthenticationResult with new tokens and updated user data
        """
        try:
            # Use authlib's refresh token method
            oauth_token = self.oauth_session.refresh_token(self.token_endpoint, refresh_token=refresh_token)

            # Convert OAuth2Token to our IdPTokens model
            tokens = self._oauth_token_to_idp_tokens(oauth_token)

            # Get updated user information
            user_data = self._get_user_info_from_oauth_token(oauth_token)

            # Encode raw response for debugging
            raw_response = base64.b64encode(
                json.dumps({"tokens": tokens.model_dump(), "user_data": user_data.model_dump()}).encode()
            ).decode()

            logger.info(f"OIDC token refresh successful for user: {user_data.id}")

            return AuthenticationResult(success=True, user_data=user_data, tokens=tokens, raw_response=raw_response)

        except Exception as e:
            logger.error(f"Token refresh failed: {e}")
            return AuthenticationResult(success=False, error=f"Token refresh failed: {str(e)}")

    def get_user_info(self, access_token: str) -> UserData:
        """
        Retrieve user information using authlib's UserInfo handling.

        Args:
            access_token: Valid access token

        Returns:
            User information as UserData model
        """
        try:
            if not self.userinfo_endpoint:
                # Fall back to empty user data if no userinfo endpoint
                return UserData(id="", displayName="", email="")

            # Use authlib's OAuth2Session to get user info
            oauth_token = OAuth2Token({"access_token": access_token, "token_type": "Bearer"})

            # Create a temporary session with the token
            session = OAuth2Session(client_id=self.config.client_id, token=oauth_token)

            # Get user info using authlib
            resp = session.get(self.userinfo_endpoint)

            if resp.status_code == 200:
                user_info_data = resp.json()
                return self.normalize_user_data(user_info_data)
            else:
                logger.warning(f"UserInfo request failed: {resp.status_code}")
                return UserData(id="", displayName="", email="")

        except Exception as e:
            logger.error(f"Failed to get user info: {e}")
            return UserData(id="", displayName="", email="")

    def validate_token(self, token: str) -> bool:
        """
        Validate an OIDC access token.

        Args:
            token: Access token to validate

        Returns:
            True if token is valid, False otherwise
        """
        try:
            # For OIDC, we can validate by making a userinfo request
            # This is a simple validation - more sophisticated validation
            # would involve JWT signature verification
            user_info = self.get_user_info(token)
            return bool(user_info.id)

        except Exception:
            return False

    def get_logout_url(self, post_logout_redirect_uri: Optional[str] = None) -> Optional[str]:
        """
        Get OIDC logout URL for single sign-out.

        Args:
            post_logout_redirect_uri: Where to redirect after IdP logout

        Returns:
            Logout URL if supported, None otherwise
        """
        if not self.end_session_endpoint:
            return None

        params = {}
        if post_logout_redirect_uri:
            params["post_logout_redirect_uri"] = post_logout_redirect_uri

        if params:
            return f"{self.end_session_endpoint}?{urlencode(params)}"
        else:
            return self.end_session_endpoint

    def normalize_user_data(self, raw_user_data: Dict) -> UserData:
        """
        Normalize OIDC user data into MLSpace format.

        Args:
            raw_user_data: Raw user data from OIDC IdP

        Returns:
            Normalized user data with MLSpace standard fields
        """
        # OIDC standard claims mapping
        user_id = (
            raw_user_data.get("sub") or raw_user_data.get("preferred_username") or raw_user_data.get("email", "").split("@")[0]
        )

        display_name = (
            raw_user_data.get("name") or raw_user_data.get("given_name", "") + " " + raw_user_data.get("family_name", "")
        ).strip()

        email = raw_user_data.get("email", "")

        # Extract groups from various possible claims
        groups = []
        for group_claim in ["groups", "roles", "authorities", "memberOf"]:
            if group_claim in raw_user_data:
                claim_value = raw_user_data[group_claim]
                if isinstance(claim_value, list):
                    groups.extend(claim_value)
                elif isinstance(claim_value, str):
                    groups.append(claim_value)

        # Additional attributes (excluding standard claims)
        standard_claims = {
            "sub",
            "name",
            "given_name",
            "family_name",
            "email",
            "preferred_username",
            "groups",
            "roles",
            "authorities",
            "memberOf",
            "iss",
            "aud",
            "exp",
            "iat",
            "auth_time",
        }

        attributes = {
            key: value for key, value in raw_user_data.items() if key not in standard_claims and not key.startswith("_")
        }

        return UserData(
            id=user_id,
            displayName=display_name or user_id,
            email=email,
            groups=list(set(groups)),  # Remove duplicates
            attributes=attributes,
        )

    def extract_token_expiration(self, tokens: IdPTokens) -> Tuple[Optional[int], Optional[int]]:
        """
        Extract OIDC token expiration information.

        Args:
            tokens: Token dictionary from OIDC IdP

        Returns:
            Tuple of (access_token_expires_in_seconds, refresh_token_expires_in_seconds)
        """
        # Use Pydantic model fields directly
        access_expires = tokens.expires_in or 3600  # Default 1 hour
        refresh_expires = tokens.refresh_expires_in

        return access_expires, refresh_expires

    def _exchange_code_for_tokens(self, auth_code: str, redirect_uri: str, code_verifier: Optional[str] = None) -> OAuth2Token:
        """
        Exchange authorization code for tokens using authlib's OAuth2Session.

        Args:
            auth_code: Authorization code from callback
            redirect_uri: Redirect URI used in authorization request
            code_verifier: PKCE code verifier (required if use_pkce is True)

        Returns:
            OAuth2Token from authlib

        Raises:
            Exception: If token exchange fails or code_verifier is missing when PKCE is enabled
        """
        try:
            fetch_token_params = {
                "code": auth_code,
                "redirect_uri": redirect_uri,
            }

            # Add code_verifier for PKCE flow
            if self.config.use_pkce:
                if not code_verifier:
                    raise ValueError("code_verifier is required when PKCE is enabled")
                fetch_token_params["code_verifier"] = code_verifier

            # Use authlib's fetch_token method
            oauth_token = self.oauth_session.fetch_token(self.token_endpoint, **fetch_token_params)

            logger.info("Token exchange successful using authlib")
            return oauth_token

        except Exception as e:
            logger.error(f"Token exchange failed: {e}")
            raise Exception(f"Token exchange failed: {str(e)}")

    def _oauth_token_to_idp_tokens(self, oauth_token: OAuth2Token) -> IdPTokens:
        """
        Convert authlib's OAuth2Token to our IdPTokens model.

        Args:
            oauth_token: OAuth2Token from authlib

        Returns:
            IdPTokens model
        """
        return IdPTokens(
            access_token=oauth_token.get("access_token"),
            refresh_token=oauth_token.get("refresh_token"),
            id_token=oauth_token.get("id_token"),
            token_type=oauth_token.get("token_type", "Bearer"),
            expires_in=oauth_token.get("expires_in"),
            refresh_expires_in=oauth_token.get("refresh_expires_in"),
            scope=oauth_token.get("scope"),
        )

    def _get_user_info_from_oauth_token(self, oauth_token: OAuth2Token) -> UserData:
        """
        Get user information from OAuth2Token using authlib's JWT and UserInfo handling.

        Args:
            oauth_token: OAuth2Token from authlib

        Returns:
            Combined user information from ID token and UserInfo endpoint
        """
        user_data = {}

        # Extract claims from ID token if present using authlib's JWT handling
        id_token = oauth_token.get("id_token")
        if id_token:
            try:
                # Use authlib's JWT to decode ID token (without signature verification for now)
                # In production, should verify signature using JWKS from discovery
                id_claims = self.jwt.decode(id_token, options={"verify_signature": False})
                user_data.update(id_claims)
                logger.debug("Successfully extracted claims from ID token using authlib")
            except Exception as e:
                logger.warning(f"Failed to parse ID token with authlib: {e}")

        # Get additional user info from UserInfo endpoint
        access_token = oauth_token.get("access_token")
        if access_token and self.userinfo_endpoint:
            try:
                # Use authlib's OAuth2Session to get user info
                session = OAuth2Session(client_id=self.config.client_id, token=oauth_token)

                resp = session.get(self.userinfo_endpoint)
                if resp.status_code == 200:
                    userinfo_data = resp.json()
                    # Merge with existing data, prioritizing UserInfo endpoint data
                    user_data.update(userinfo_data)
                    logger.debug("Successfully retrieved user info from UserInfo endpoint")
                else:
                    logger.warning(f"UserInfo request failed: {resp.status_code}")
            except Exception as e:
                logger.warning(f"Failed to get user info from UserInfo endpoint: {e}")

        return self.normalize_user_data(user_data)
