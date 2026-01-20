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

from unittest.mock import Mock, patch

import pytest

from ml_space_lambda.auth.handlers.oidc_handler import OIDCConfig, OIDCHandler


class TestOIDCHandler:
    """Test OIDC authentication handler."""

    def setup_method(self):
        """Set up test fixtures."""
        self.config = OIDCConfig(
            issuer_url="https://example.com",
            client_id="test-client-id",
            client_secret="test-client-secret",
            scopes=["openid", "profile", "email"],
        )

        # Mock discovery document
        self.discovery_doc = {
            "authorization_endpoint": "https://example.com/auth",
            "token_endpoint": "https://example.com/token",
            "userinfo_endpoint": "https://example.com/userinfo",
            "jwks_uri": "https://example.com/jwks",
            "end_session_endpoint": "https://example.com/logout",
        }

    def test_init_missing_required_config(self):
        """Test initialization with missing required configuration."""
        with pytest.raises(ValueError):
            OIDCConfig()

        with pytest.raises(ValueError):
            OIDCConfig(issuer_url="https://example.com")

    @patch("requests.get")
    def test_init_successful_discovery(self, mock_get):
        """Test successful OIDC discovery."""
        mock_response = Mock()
        mock_response.ok = True
        mock_response.json.return_value = self.discovery_doc
        mock_get.return_value = mock_response

        handler = OIDCHandler(self.config)

        assert handler.config.issuer_url == "https://example.com"
        assert handler.config.client_id == "test-client-id"
        assert handler.config.client_secret == "test-client-secret"
        assert handler.authorization_endpoint == "https://example.com/auth"
        assert handler.token_endpoint == "https://example.com/token"

    @patch("requests.get")
    def test_init_discovery_failure(self, mock_get):
        """Test OIDC discovery failure."""
        mock_get.side_effect = Exception("Network error")

        with pytest.raises(Exception, match="Failed to discover OIDC endpoints"):
            OIDCHandler(self.config)

    @patch("requests.get")
    def test_get_authorization_url(self, mock_get):
        """Test authorization URL generation."""
        mock_response = Mock()
        mock_response.ok = True
        mock_response.json.return_value = self.discovery_doc
        mock_get.return_value = mock_response

        handler = OIDCHandler(self.config)

        # Generate code_verifier for PKCE
        from authlib.common.security import generate_token

        code_verifier = generate_token(48)

        auth_url = handler.get_authorization_url("test-state", "https://app.example.com/callback", code_verifier=code_verifier)

        assert "https://example.com/auth" in auth_url
        assert "client_id=test-client-id" in auth_url
        assert "state=test-state" in auth_url
        assert "redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback" in auth_url

    def test_normalize_user_data(self):
        """Test user data normalization."""
        # Create handler without discovery for testing
        handler = self._create_test_handler()

        raw_data = {
            "sub": "user123",
            "name": "John Doe",
            "email": "john.doe@example.com",
            "groups": ["admin", "users"],
            "department": "Engineering",
            "iss": "https://example.com",
            "aud": "test-client",
            "exp": 1234567890,
        }

        normalized = handler.normalize_user_data(raw_data)

        assert normalized.id == "user123"
        assert normalized.displayName == "John Doe"
        assert normalized.email == "john.doe@example.com"
        assert set(normalized.groups) == {"admin", "users"}
        assert normalized.attributes["department"] == "Engineering"
        # Standard OIDC claims should not be in attributes
        assert "iss" not in normalized.attributes
        assert "aud" not in normalized.attributes

    def test_normalize_user_data_fallbacks(self):
        """Test user data normalization with fallback values."""
        handler = self._create_test_handler()

        # Test with minimal data
        raw_data = {"preferred_username": "jdoe", "given_name": "John", "family_name": "Doe"}

        normalized = handler.normalize_user_data(raw_data)

        assert normalized.id == "jdoe"
        assert normalized.displayName == "John Doe"
        assert normalized.email == ""
        assert normalized.groups == []

    def test_extract_token_expiration(self):
        """Test token expiration extraction."""
        handler = self._create_test_handler()

        from ml_space_lambda.auth.models.auth_models import IdPTokens

        # Test with standard expires_in
        tokens = IdPTokens(access_token="token123", expires_in=3600, refresh_token="refresh123")

        access_exp, refresh_exp = handler.extract_token_expiration(tokens)
        assert access_exp == 3600
        assert refresh_exp is None

        # Test with refresh expiration
        tokens = IdPTokens(access_token="token123", expires_in=3600, refresh_token="refresh123", refresh_expires_in=7200)
        access_exp, refresh_exp = handler.extract_token_expiration(tokens)
        assert access_exp == 3600
        assert refresh_exp == 7200

        # Test with missing expiration (should default to 1 hour)
        tokens = IdPTokens(access_token="token123")
        access_exp, refresh_exp = handler.extract_token_expiration(tokens)
        assert access_exp == 3600
        assert refresh_exp is None

    def test_get_user_info(self):
        """Test user info retrieval."""
        handler = self._create_test_handler()

        user_data = {"sub": "user123", "name": "John Doe", "email": "john.doe@example.com"}

        # Mock the normalize_user_data method to return expected result
        with patch.object(handler, "normalize_user_data") as mock_normalize:
            from ml_space_lambda.auth.models.auth_models import UserData

            expected_user = UserData(id="user123", displayName="John Doe", email="john.doe@example.com")
            mock_normalize.return_value = expected_user

            # Mock OAuth2Session.get method
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = user_data

            # Patch OAuth2Session at the module level where it's used
            with patch("ml_space_lambda.auth.handlers.oidc_handler.OAuth2Session") as mock_session_class:
                mock_session = Mock()
                mock_session.get.return_value = mock_response
                mock_session_class.return_value = mock_session

                result = handler.get_user_info("test-access-token")

                assert result.id == "user123"
                assert result.displayName == "John Doe"
                assert result.email == "john.doe@example.com"

                # Verify normalize_user_data was called with the response
                mock_normalize.assert_called_once_with(user_data)

    @patch("requests.get")
    def test_get_user_info_failure(self, mock_get):
        """Test user info retrieval failure."""
        handler = self._create_test_handler()

        mock_response = Mock()
        mock_response.ok = False
        mock_response.status_code = 401
        mock_get.return_value = mock_response

        result = handler.get_user_info("invalid-token")

        assert result.id == ""

    def test_validate_token(self):
        """Test token validation."""
        handler = self._create_test_handler()

        from ml_space_lambda.auth.models.auth_models import UserData

        # Mock get_user_info to return user data for valid token
        with patch.object(handler, "get_user_info") as mock_get_user_info:
            mock_get_user_info.return_value = UserData(id="user123", displayName="Test", email="test@example.com")
            assert handler.validate_token("valid-token") is True

            mock_get_user_info.return_value = UserData(id="", displayName="", email="")
            assert handler.validate_token("invalid-token") is False

    def test_get_logout_url(self):
        """Test logout URL generation."""
        handler = self._create_test_handler()

        # Test without post-logout redirect
        logout_url = handler.get_logout_url()
        assert logout_url == "https://example.com/logout"

        # Test with post-logout redirect
        logout_url = handler.get_logout_url("https://app.example.com/")
        assert "https://example.com/logout" in logout_url
        assert "post_logout_redirect_uri=https%3A%2F%2Fapp.example.com%2F" in logout_url

    def test_get_logout_url_no_endpoint(self):
        """Test logout URL when endpoint not available."""
        handler = self._create_test_handler()
        handler.end_session_endpoint = None

        logout_url = handler.get_logout_url()
        assert logout_url is None

    def test_refresh_tokens_success(self):
        """Test successful token refresh."""
        from authlib.oauth2.rfc6749 import OAuth2Token

        from ml_space_lambda.auth.models.auth_models import UserData

        handler = self._create_test_handler()

        new_oauth_token = OAuth2Token(
            {
                "access_token": "new-access-token",
                "refresh_token": "new-refresh-token",
                "expires_in": 3600,
                "token_type": "Bearer",
            }
        )

        # Mock authlib's refresh_token method
        with patch.object(handler.oauth_session, "refresh_token") as mock_refresh:
            mock_refresh.return_value = new_oauth_token

            # Mock user info retrieval
            with patch.object(handler, "_get_user_info_from_oauth_token") as mock_get_user_info:
                mock_get_user_info.return_value = UserData(id="user123", displayName="John Doe", email="john@example.com")

                result = handler.refresh_tokens("old-refresh-token")

                assert result.success is True
                assert result.tokens.access_token == "new-access-token"
                assert result.user_data.id == "user123"
                mock_refresh.assert_called_once_with(handler.token_endpoint, refresh_token="old-refresh-token")

    def test_refresh_tokens_failure(self):
        """Test token refresh failure."""
        handler = self._create_test_handler()

        # Mock authlib's refresh_token method to raise an exception
        with patch.object(handler.oauth_session, "refresh_token") as mock_refresh:
            mock_refresh.side_effect = Exception("Invalid refresh token")

            result = handler.refresh_tokens("invalid-refresh-token")

            assert result.success is False
            assert "Token refresh failed: Invalid refresh token" in result.error

    def _create_test_handler(self):
        """Create OIDC handler for testing without discovery."""

        class TestOIDCHandler(OIDCHandler):
            def _discover_endpoints(self):
                self.authorization_endpoint = "https://example.com/auth"
                self.token_endpoint = "https://example.com/token"
                self.userinfo_endpoint = "https://example.com/userinfo"
                self.jwks_uri = "https://example.com/jwks"
                self.end_session_endpoint = "https://example.com/logout"

        return TestOIDCHandler(self.config)
