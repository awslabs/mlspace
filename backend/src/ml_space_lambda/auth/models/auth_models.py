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
Shared authentication data models.

Common data structures used across different authentication handlers and flows.
"""

from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class AuthStatus(str, Enum):
    """Authentication status enumeration."""

    AUTHENTICATED = "AUTHENTICATED"
    UNAUTHENTICATED = "UNAUTHENTICATED"


class AuthError(str, Enum):
    """Authentication error codes."""

    NO_SESSION = "NO_SESSION"
    SESSION_EXPIRED = "SESSION_EXPIRED"
    INVALID_SESSION = "INVALID_SESSION"
    TOKEN_REFRESH_FAILED = "TOKEN_REFRESH_FAILED"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    INVALID_CONFIGURATION = "INVALID_CONFIGURATION"


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


class SessionInfo(BaseModel):
    """Session information for identity responses."""

    expiresAt: str = Field(..., description="Session expiration timestamp (ISO 8601)")
    refreshAt: str = Field(..., description="Token refresh threshold timestamp (ISO 8601)")
    provider: str = Field(..., description="Identity provider type")
    refreshed: Optional[bool] = Field(None, description="Whether tokens were refreshed in this request")


class IdentityResponse(BaseModel):
    """Response model for /auth/identity endpoint."""

    status: AuthStatus = Field(..., description="Authentication status")
    user: Optional[UserData] = Field(None, description="User identity information")
    session: Optional[SessionInfo] = Field(None, description="Session information")
    error: Optional[AuthError] = Field(None, description="Error code if unauthenticated")
    message: Optional[str] = Field(None, description="Human-readable error message")
    timestamp: Optional[str] = Field(None, description="Error timestamp")


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
