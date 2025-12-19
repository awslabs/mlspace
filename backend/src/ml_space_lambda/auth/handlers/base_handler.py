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
Abstract base class for Identity Provider authentication handlers.

Defines the interface that all IdP handlers must implement for the BFF authentication pattern.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Tuple

from pydantic import BaseModel, Field


class UserData(BaseModel):
    """
    Normalized user identity information from Identity Provider.
    """

    id: str = Field(..., description="Unique user identifier")
    displayName: str = Field(..., description="User's display name")
    email: str = Field(..., description="User's email address")
    groups: List[str] = Field(default_factory=list, description="List of group memberships")
    attributes: Dict[str, str] = Field(default_factory=dict, description="Additional user attributes")


class IdPTokens(BaseModel):
    """
    Identity Provider tokens.
    """

    access_token: Optional[str] = Field(None, description="OAuth2 access token")
    refresh_token: Optional[str] = Field(None, description="OAuth2 refresh token")
    id_token: Optional[str] = Field(None, description="OIDC ID token")
    token_type: Optional[str] = Field(None, description="Token type (usually 'Bearer')")
    expires_in: Optional[int] = Field(None, description="Access token expiration in seconds")
    refresh_expires_in: Optional[int] = Field(None, description="Refresh token expiration in seconds")
    scope: Optional[str] = Field(None, description="Granted OAuth2 scopes")


class AuthenticationResult(BaseModel):
    """
    Result of an authentication operation.

    Contains user identity information and tokens from the Identity Provider.
    """

    success: bool = Field(..., description="Whether authentication was successful")
    user_data: Optional[UserData] = Field(None, description="User identity information")
    tokens: Optional[IdPTokens] = Field(None, description="IdP tokens")
    error: Optional[str] = Field(None, description="Error message if authentication failed")
    raw_response: Optional[str] = Field(None, description="Raw IdP response for debugging (base64 encoded)")


class AuthHandlerConfig(BaseModel):
    """
    Base configuration for authentication handlers.
    """

    pass  # Subclasses will extend this with specific configuration fields


class BaseAuthHandler(ABC):
    """
    Abstract base class for Identity Provider authentication handlers.

    Each IdP type (OIDC, SAML, custom) implements this interface to provide
    consistent authentication flows for the BFF pattern.
    """

    def __init__(self, config: AuthHandlerConfig):
        """
        Initialize authentication handler with configuration.

        Args:
            config: IdP-specific configuration (Pydantic model)
        """
        self.config = config

    @abstractmethod
    def get_authorization_url(self, state: str, redirect_uri: str) -> str:
        """
        Generate authorization URL for redirecting user to IdP.

        Args:
            state: CSRF protection state parameter
            redirect_uri: Where IdP should redirect after authentication

        Returns:
            Authorization URL for user redirection

        Raises:
            Exception: If URL generation fails
        """

    @abstractmethod
    def handle_callback(self, callback_data: Dict, redirect_uri: str) -> AuthenticationResult:
        """
        Process IdP callback and exchange for tokens.

        Args:
            callback_data: Data from IdP callback (query params, form data, etc.)
            redirect_uri: Redirect URI used in authorization request

        Returns:
            AuthenticationResult with user data and tokens

        Raises:
            Exception: If token exchange or user info retrieval fails
        """

    @abstractmethod
    def refresh_tokens(self, refresh_token: str) -> AuthenticationResult:
        """
        Refresh access tokens using refresh token.

        Args:
            refresh_token: Valid refresh token from previous authentication

        Returns:
            AuthenticationResult with new tokens and updated user data

        Raises:
            Exception: If token refresh fails
        """

    @abstractmethod
    def get_user_info(self, access_token: str) -> UserData:
        """
        Retrieve user information using access token.

        Args:
            access_token: Valid access token

        Returns:
            User information dictionary

        Raises:
            Exception: If user info retrieval fails
        """

    @abstractmethod
    def validate_token(self, token: str) -> bool:
        """
        Validate an access token without making external calls if possible.

        Args:
            token: Access token to validate

        Returns:
            True if token is valid, False otherwise
        """

    def get_logout_url(self, post_logout_redirect_uri: Optional[str] = None) -> Optional[str]:
        """
        Get IdP logout URL for single sign-out.

        Args:
            post_logout_redirect_uri: Where to redirect after IdP logout

        Returns:
            Logout URL if supported by IdP, None otherwise
        """
        # Default implementation - not all IdPs support logout URLs
        return None

    def normalize_user_data(self, raw_user_data: Dict) -> UserData:
        """
        Normalize IdP-specific user data into MLSpace format.

        Args:
            raw_user_data: Raw user data from IdP

        Returns:
            Normalized UserData model
        """
        # Default implementation - subclasses should override for IdP-specific mapping
        return UserData(
            id=raw_user_data.get("sub") or raw_user_data.get("id", ""),
            displayName=raw_user_data.get("name") or raw_user_data.get("displayName", ""),
            email=raw_user_data.get("email", ""),
            groups=raw_user_data.get("groups", []),
            attributes={
                key: str(value)
                for key, value in raw_user_data.items()
                if key not in ["sub", "id", "name", "displayName", "email", "groups"] and value is not None
            },
        )

    def extract_token_expiration(self, tokens: IdPTokens) -> Tuple[Optional[int], Optional[int]]:
        """
        Extract token expiration information.

        Args:
            tokens: IdPTokens model from IdP

        Returns:
            Tuple of (access_token_expires_in_seconds, refresh_token_expires_in_seconds)
            None values indicate no expiration information available
        """
        # Default implementation - subclasses should override for IdP-specific logic
        return tokens.expires_in, tokens.refresh_expires_in
