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

import json
import os
from unittest.mock import Mock, patch

from ml_space_lambda.auth.lambda_functions import callback, callback_post, identity, login, logout


class TestAuthLambdaFunctions:
    """Test authentication lambda functions."""

    def setup_method(self):
        """Set up test fixtures."""
        self.mock_context = Mock()
        self.mock_context.aws_request_id = "test-request-id"

        # Mock environment variables
        self.env_vars = {
            "AUTH_IDP_TYPE": "oidc",
            "AUTH_OIDC_URL": "https://example.com",
            "AUTH_OIDC_CLIENT_ID": "test-client-id",
            "AUTH_OIDC_CLIENT_SECRET_NAME": "test/client-secret",
            "AUTH_OIDC_USE_PKCE": "true",
            "AUTH_STATE_ENCRYPTION_KEY_SECRET_NAME": "test/state-key",
            "AUTH_TOKEN_ENCRYPTION_KEY_SECRET_NAME": "test/token-key",
            "AUTH_SESSION_TABLE_NAME": "test-session-table",
            "AUTH_OIDC_VERIFY_SSL": "true",
            "AUTH_OIDC_VERIFY_SIGNATURE": "true",
            "AUTH_PRIMARY_DOMAIN": "",
            "AUTH_SYNC_DOMAINS": "",
            "WEB_CUSTOM_DOMAIN_NAME": "",
        }

        # Mock SSM responses (legacy - keeping for backward compatibility tests)
        # Generate a valid Fernet key for testing
        import base64

        from cryptography.fernet import Fernet

        test_fernet_key = Fernet.generate_key().decode("utf-8")
        # Generate a 32-byte key for token encryption and encode as base64
        test_token_key = base64.b64encode(os.urandom(32)).decode("utf-8")

        self.mock_ssm_responses = {
            "/test/client-secret": "test-client-secret",
            "/test/state-key": test_fernet_key,
            "/test/token-key": test_token_key,
        }

        # Mock Secrets Manager responses
        self.mock_secrets_responses = {
            "test/client-secret": {
                "current_version": 1,
                "keys": {"1": "test-client-secret"},
                "key_type": "token",
                "created_by": "test",
            },
            "test/state-key": {
                "current_version": 1,
                "keys": {"1": test_fernet_key},
                "key_type": "state",
                "created_by": "test",
            },
            "test/token-key": {"current_version": 1, "keys": {"1": test_token_key}, "key_type": "token", "created_by": "test"},
        }

    @patch.dict("os.environ", {})
    def test_login_missing_config(self):
        """Test login with missing configuration."""
        event = {
            "headers": {"Host": "app.example.com"},
            "body": json.dumps({"redirectUrl": "/dashboard"}),
        }

        response = login(event, self.mock_context)

        assert response["statusCode"] == 400
        body = json.loads(response["body"])
        assert body["error"] == "INVALID_CONFIGURATION"
        assert "AUTH_OIDC_URL" in body["message"]

    @patch.dict("os.environ")
    @patch("ml_space_lambda.auth.lambda_functions.secrets_client")
    @patch("ml_space_lambda.auth.lambda_functions.ssm_client")
    @patch("ml_space_lambda.auth.lambda_functions.OIDCHandler")
    @patch("ml_space_lambda.auth.lambda_functions.StateManager")
    def test_login_success(self, mock_state_manager_class, mock_oidc_handler_class, mock_ssm_client, mock_secrets_client):
        """Test successful login flow."""
        # Set up environment
        for key, value in self.env_vars.items():
            os.environ[key] = value

        # Mock SSM client
        def mock_get_parameter(Name, WithDecryption=True):
            return {"Parameter": {"Value": self.mock_ssm_responses[Name]}}

        mock_ssm_client.get_parameter.side_effect = mock_get_parameter

        # Mock Secrets Manager client
        def mock_get_secret_value(SecretId):
            secret_data = self.mock_secrets_responses[SecretId]
            return {"SecretString": json.dumps(secret_data)}

        mock_secrets_client.get_secret_value.side_effect = mock_get_secret_value

        # Mock state manager
        mock_state_manager = Mock()
        mock_state_manager.generate_nonce.return_value = "test-nonce"
        mock_state_manager.create_state.return_value = "encrypted-state"
        mock_state_manager_class.return_value = mock_state_manager

        # Mock OIDC handler
        mock_oidc_handler = Mock()
        mock_oidc_handler.get_authorization_url.return_value = "https://example.com/auth?client_id=test&state=encrypted-state"
        mock_oidc_handler_class.return_value = mock_oidc_handler

        event = {
            "headers": {"Host": "app.example.com"},
            "body": json.dumps({"redirectUrl": "/dashboard"}),
        }

        response = login(event, self.mock_context)

        # Verify response
        assert response["statusCode"] == 302
        assert "Location" in response["headers"]
        assert "https://example.com/auth" in response["headers"]["Location"]
        assert "multiValueHeaders" in response
        assert "Set-Cookie" in response["multiValueHeaders"]

        # Verify state cookie
        cookies = response["multiValueHeaders"]["Set-Cookie"]
        state_cookie = next((c for c in cookies if "mlspace_auth_state" in c), None)
        assert state_cookie is not None
        assert "test-nonce" in state_cookie
        assert "HttpOnly" in state_cookie
        assert "Secure" in state_cookie

    @patch.dict("os.environ")
    @patch("ml_space_lambda.auth.lambda_functions.secrets_client")
    @patch("ml_space_lambda.auth.lambda_functions.ssm_client")
    @patch("ml_space_lambda.auth.lambda_functions.OIDCHandler")
    @patch("ml_space_lambda.auth.lambda_functions.StateManager")
    def test_login_with_custom_domain(
        self, mock_state_manager_class, mock_oidc_handler_class, mock_ssm_client, mock_secrets_client
    ):
        """Test login flow uses WEB_CUSTOM_DOMAIN_NAME when configured."""
        # Set up environment with custom domain
        env_vars = self.env_vars.copy()
        env_vars["WEB_CUSTOM_DOMAIN_NAME"] = "https://mlspace.example.com"

        for key, value in env_vars.items():
            os.environ[key] = value

        # Mock SSM client
        def mock_get_parameter(Name, WithDecryption=True):
            return {"Parameter": {"Value": self.mock_ssm_responses[Name]}}

        mock_ssm_client.get_parameter.side_effect = mock_get_parameter

        # Mock Secrets Manager client
        def mock_get_secret_value(SecretId):
            secret_data = self.mock_secrets_responses[SecretId]
            return {"SecretString": json.dumps(secret_data)}

        mock_secrets_client.get_secret_value.side_effect = mock_get_secret_value

        # Mock state manager
        mock_state_manager = Mock()
        mock_state_manager.generate_nonce.return_value = "test-nonce"
        mock_state_manager.create_state.return_value = "encrypted-state"
        mock_state_manager_class.return_value = mock_state_manager

        # Mock OIDC handler
        mock_oidc_handler = Mock()
        mock_oidc_handler.get_authorization_url.return_value = "https://idp.example.com/auth?state=encrypted-state"
        mock_oidc_handler_class.return_value = mock_oidc_handler

        event = {
            "headers": {"Host": "api-gateway-id.execute-api.us-east-1.amazonaws.com"},
            "queryStringParameters": {"redirectUrl": "/dashboard"},
        }

        response = login(event, self.mock_context)

        # Verify response
        assert response["statusCode"] == 302

        # Verify OIDC handler was called with custom domain in redirect_uri
        mock_oidc_handler.get_authorization_url.assert_called_once()
        call_kwargs = mock_oidc_handler.get_authorization_url.call_args[1]
        assert call_kwargs["redirect_uri"] == "https://mlspace.example.com/auth/callback"

    @patch.dict("os.environ")
    @patch("ml_space_lambda.auth.lambda_functions.secrets_client")
    @patch("ml_space_lambda.auth.lambda_functions.ssm_client")
    def test_login_invalid_redirect_url(self, mock_ssm_client, mock_secrets_client):
        """Test login with invalid redirect URL."""
        # Set up environment
        for key, value in self.env_vars.items():
            os.environ[key] = value

        # Mock SSM client
        def mock_get_parameter(Name, WithDecryption=True):
            return {"Parameter": {"Value": self.mock_ssm_responses[Name]}}

        mock_ssm_client.get_parameter.side_effect = mock_get_parameter

        # Mock Secrets Manager client
        def mock_get_secret_value(SecretId):
            secret_data = self.mock_secrets_responses[SecretId]
            return {"SecretString": json.dumps(secret_data)}

        mock_secrets_client.get_secret_value.side_effect = mock_get_secret_value

        with patch("ml_space_lambda.auth.lambda_functions.OIDCHandler") as mock_oidc_handler_class, patch(
            "ml_space_lambda.auth.lambda_functions.StateManager"
        ) as mock_state_manager_class:

            # Mock state manager
            mock_state_manager = Mock()
            mock_state_manager.generate_nonce.return_value = "test-nonce"
            mock_state_manager.create_state.return_value = "encrypted-state"
            mock_state_manager_class.return_value = mock_state_manager

            # Mock OIDC handler
            mock_oidc_handler = Mock()
            mock_oidc_handler.get_authorization_url.return_value = "https://example.com/auth"
            mock_oidc_handler_class.return_value = mock_oidc_handler

            event = {
                "headers": {"Host": "app.example.com"},
                "body": json.dumps({"redirectUrl": "https://malicious.com/steal"}),
            }

            response = login(event, self.mock_context)

            # Should still succeed but use safe redirect
            assert response["statusCode"] == 302

            # Verify state was created with safe redirect URL
            mock_state_manager.create_state.assert_called_once()
            call_args = mock_state_manager.create_state.call_args[1]
            assert call_args["redirect_url"] == "/"  # Should default to safe URL

    @patch.dict("os.environ")
    @patch("ml_space_lambda.auth.lambda_functions.secrets_client")
    @patch("ml_space_lambda.auth.lambda_functions.ssm_client")
    def test_login_no_body(self, mock_ssm_client, mock_secrets_client):
        """Test login with no request body."""
        # Set up environment
        for key, value in self.env_vars.items():
            os.environ[key] = value

        # Mock SSM client
        def mock_get_parameter(Name, WithDecryption=True):
            return {"Parameter": {"Value": self.mock_ssm_responses[Name]}}

        mock_ssm_client.get_parameter.side_effect = mock_get_parameter

        # Mock Secrets Manager client
        def mock_get_secret_value(SecretId):
            secret_data = self.mock_secrets_responses[SecretId]
            return {"SecretString": json.dumps(secret_data)}

        mock_secrets_client.get_secret_value.side_effect = mock_get_secret_value

        with patch("ml_space_lambda.auth.lambda_functions.OIDCHandler") as mock_oidc_handler_class, patch(
            "ml_space_lambda.auth.lambda_functions.StateManager"
        ) as mock_state_manager_class:

            # Mock state manager
            mock_state_manager = Mock()
            mock_state_manager.generate_nonce.return_value = "test-nonce"
            mock_state_manager.create_state.return_value = "encrypted-state"
            mock_state_manager_class.return_value = mock_state_manager

            # Mock OIDC handler
            mock_oidc_handler = Mock()
            mock_oidc_handler.get_authorization_url.return_value = "https://example.com/auth"
            mock_oidc_handler_class.return_value = mock_oidc_handler

            event = {
                "headers": {"Host": "app.example.com"},
                # No body
            }

            response = login(event, self.mock_context)

            # Should succeed with default redirect
            assert response["statusCode"] == 302

            # Verify state was created with default redirect URL
            mock_state_manager.create_state.assert_called_once()
            call_args = mock_state_manager.create_state.call_args[1]
            assert call_args["redirect_url"] == "/"

    @patch.dict("os.environ")
    @patch("ml_space_lambda.auth.lambda_functions.ssm_client")
    def test_login_ssm_error(self, mock_ssm_client):
        """Test login with SSM parameter retrieval error."""
        # Set up environment - use empty state key param to trigger SSM error
        env_vars = self.env_vars.copy()
        env_vars["AUTH_STATE_ENCRYPTION_KEY_SSM_PARAM"] = "/test/missing-key"

        for key, value in env_vars.items():
            os.environ[key] = value

        # Mock SSM client to raise exception for missing key
        def mock_get_parameter(Name, WithDecryption=True):
            if Name == "/test/missing-key":
                raise Exception("Parameter not found")
            return {"Parameter": {"Value": self.mock_ssm_responses.get(Name, "")}}

        mock_ssm_client.get_parameter.side_effect = mock_get_parameter

        event = {
            "headers": {"Host": "app.example.com"},
            "body": json.dumps({"redirectUrl": "/dashboard"}),
        }

        response = login(event, self.mock_context)

        assert response["statusCode"] == 400
        body = json.loads(response["body"])
        assert body["error"] == "INVALID_CONFIGURATION"
        assert "Failed to discover OIDC endpoints" in body["message"]

    @patch.dict("os.environ")
    def test_login_unsupported_idp_type(self):
        """Test login with unsupported IdP type."""
        # Set up environment with unsupported IdP type
        env_vars = self.env_vars.copy()
        env_vars["AUTH_IDP_TYPE"] = "saml"

        for key, value in env_vars.items():
            os.environ[key] = value

        event = {
            "headers": {"Host": "app.example.com"},
            "body": json.dumps({"redirectUrl": "/dashboard"}),
        }

        response = login(event, self.mock_context)

        assert response["statusCode"] == 400
        body = json.loads(response["body"])
        assert body["error"] == "INVALID_CONFIGURATION"
        assert "Unsupported IdP type: saml" in body["message"]
        assert "Only 'oidc' is currently supported" in body["message"]

    @patch.dict("os.environ")
    @patch("ml_space_lambda.auth.lambda_functions.secrets_client")
    @patch("ml_space_lambda.auth.lambda_functions.ssm_client")
    @patch("ml_space_lambda.auth.lambda_functions.OIDCHandler")
    @patch("ml_space_lambda.auth.lambda_functions.StateManager")
    @patch("ml_space_lambda.auth.lambda_functions.SessionManager")
    @patch("ml_space_lambda.auth.lambda_functions.OTACManager")
    @patch("ml_space_lambda.data_access_objects.dynamo_data_store.boto3")
    @patch("ml_space_lambda.auth.lambda_functions.get_environment_variables")
    def test_callback_success(
        self,
        mock_get_env_vars,
        mock_boto3,
        mock_otac_manager_class,
        mock_session_manager_class,
        mock_state_manager_class,
        mock_oidc_handler_class,
        mock_ssm_client,
        mock_secrets_client,
    ):
        """Test successful callback flow."""
        # Set up environment
        for key, value in self.env_vars.items():
            os.environ[key] = value

        # Mock environment variables for user creation
        mock_get_env_vars.return_value = {
            "NEW_USERS_SUSPENDED": "False",
            "USERS_TABLE": "test-users-table",
        }

        # Mock DynamoDB client for UserDAO
        mock_dynamodb_client = Mock()
        mock_dynamodb_client.get_item.return_value = {}  # User doesn't exist
        mock_dynamodb_client.put_item.return_value = {}
        mock_boto3.client.return_value = mock_dynamodb_client

        # Mock SSM client
        def mock_get_parameter(Name, WithDecryption=True):
            return {"Parameter": {"Value": self.mock_ssm_responses[Name]}}

        mock_ssm_client.get_parameter.side_effect = mock_get_parameter

        # Mock Secrets Manager client
        def mock_get_secret_value(SecretId):
            secret_data = self.mock_secrets_responses[SecretId]
            return {"SecretString": json.dumps(secret_data)}

        mock_secrets_client.get_secret_value.side_effect = mock_get_secret_value

        # Mock state manager
        mock_state_manager = Mock()
        mock_state_manager.validate_state.return_value = {
            "redirect_url": "/dashboard",
            "nonce": "test-nonce",
            "domain": "app.example.com",
        }
        mock_state_manager_class.return_value = mock_state_manager

        # Mock OIDC handler
        from ml_space_lambda.auth.models.auth_models import AuthenticationResult, IdPTokens, UserData

        mock_user_data = UserData(
            id="test-user",
            displayName="Test User",
            email="test@example.com",
            groups=["users"],
            attributes={"sub": "idp-sub-12345"},  # Include sub claim in attributes
        )

        mock_tokens = IdPTokens(
            access_token="access-token", refresh_token="refresh-token", id_token="id-token", expires_in=3600
        )

        mock_auth_result = AuthenticationResult(
            success=True, user_data=mock_user_data, tokens=mock_tokens, raw_response="raw-response"
        )

        mock_oidc_handler = Mock()
        mock_oidc_handler.handle_callback.return_value = mock_auth_result
        mock_oidc_handler.extract_token_expiration.return_value = (3600, 86400)
        mock_oidc_handler_class.return_value = mock_oidc_handler

        # Mock session manager
        mock_session_manager = Mock()
        mock_session_manager.create_session.return_value = "session:test-session-id"
        mock_session_manager_class.return_value = mock_session_manager

        # Mock OTAC manager
        mock_otac_manager = Mock()
        mock_otac_manager_class.return_value = mock_otac_manager

        event = {
            "headers": {"Host": "app.example.com", "Cookie": "mlspace_auth_state=test-nonce"},
            "queryStringParameters": {"code": "auth-code", "state": "encrypted-state"},
        }

        response = callback(event, self.mock_context)

        # Verify response
        assert response["statusCode"] == 302
        assert "Location" in response["headers"]
        assert response["headers"]["Location"] == "/dashboard"
        assert "multiValueHeaders" in response
        assert "Set-Cookie" in response["multiValueHeaders"]

        # Verify user was checked and created
        mock_dynamodb_client.get_item.assert_called()
        mock_dynamodb_client.put_item.assert_called()

    @patch.dict("os.environ")
    @patch("ml_space_lambda.auth.lambda_functions.ssm_client")
    def test_callback_missing_code(self, mock_ssm_client):
        """Test callback with missing authorization code."""
        # Set up environment
        for key, value in self.env_vars.items():
            os.environ[key] = value

        # Mock SSM client
        def mock_get_parameter(Name, WithDecryption=True):
            return {"Parameter": {"Value": self.mock_ssm_responses[Name]}}

        mock_ssm_client.get_parameter.side_effect = mock_get_parameter

        event = {
            "headers": {"Host": "app.example.com"},
            "queryStringParameters": {
                "state": "encrypted-state"
                # Missing "code"
            },
        }

        response = callback(event, self.mock_context)

        # Should redirect with error
        assert response["statusCode"] == 302
        assert "error=invalid_request" in response["headers"]["Location"]

    @patch.dict("os.environ")
    @patch("ml_space_lambda.auth.lambda_functions.ssm_client")
    def test_callback_idp_error(self, mock_ssm_client):
        """Test callback with IdP error response."""
        # Set up environment
        for key, value in self.env_vars.items():
            os.environ[key] = value

        # Mock SSM client
        def mock_get_parameter(Name, WithDecryption=True):
            return {"Parameter": {"Value": self.mock_ssm_responses[Name]}}

        mock_ssm_client.get_parameter.side_effect = mock_get_parameter

        event = {
            "headers": {"Host": "app.example.com"},
            "queryStringParameters": {"error": "access_denied", "error_description": "User denied access"},
        }

        response = callback(event, self.mock_context)

        # Should redirect with error
        assert response["statusCode"] == 302
        assert "error=authentication_failed" in response["headers"]["Location"]

    @patch.dict("os.environ")
    def test_callback_post_unsupported(self):
        """Test POST callback for unsupported IdP type."""
        # Set up environment
        for key, value in self.env_vars.items():
            os.environ[key] = value

        event = {"headers": {"Host": "app.example.com"}, "body": "saml-assertion-data"}

        response = callback_post(event, self.mock_context)

        # Should redirect with error (SAML not implemented)
        assert response["statusCode"] == 302
        assert "error=unsupported_callback" in response["headers"]["Location"]

    @patch.dict("os.environ")
    @patch("ml_space_lambda.auth.lambda_functions.ssm_client")
    @patch("ml_space_lambda.auth.lambda_functions.SessionManager")
    def test_logout_success(self, mock_session_manager_class, mock_ssm_client):
        """Test successful logout flow."""
        # Set up environment
        for key, value in self.env_vars.items():
            os.environ[key] = value

        # Mock SSM client
        def mock_get_parameter(Name, WithDecryption=True):
            return {"Parameter": {"Value": self.mock_ssm_responses[Name]}}

        mock_ssm_client.get_parameter.side_effect = mock_get_parameter

        # Mock session manager
        mock_session_manager = Mock()
        mock_session_manager.get_session.return_value = {
            "data": {
                "user": {"id": "test-user", "displayName": "Test User", "email": "test@example.com"},
                "session": {"provider": "oidc"},
            }
        }
        mock_session_manager.delete_session.return_value = True
        mock_session_manager_class.return_value = mock_session_manager

        event = {
            "headers": {"Host": "app.example.com", "Cookie": "mlspace_session=session:test-session-id"},
            "body": json.dumps({"logoutFromIdp": False}),
        }

        response = logout(event, self.mock_context)

        # Verify response
        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["status"] == "LOGGED_OUT"
        assert "idpLogoutUrl" not in body

        # Verify session cookie is cleared
        assert "multiValueHeaders" in response
        assert "Set-Cookie" in response["multiValueHeaders"]
        cookies = response["multiValueHeaders"]["Set-Cookie"]
        session_cookie = next((c for c in cookies if "mlspace_session" in c), None)
        assert session_cookie is not None
        assert "Max-Age=0" in session_cookie

        # Verify session deletion was called
        mock_session_manager.delete_session.assert_called_once_with("session:test-session-id")

    @patch.dict("os.environ")
    @patch("ml_space_lambda.auth.lambda_functions.ssm_client")
    @patch("ml_space_lambda.auth.lambda_functions.SessionManager")
    @patch("ml_space_lambda.auth.lambda_functions.OIDCHandler")
    def test_logout_with_idp_logout(self, mock_oidc_handler_class, mock_session_manager_class, mock_ssm_client):
        """Test logout with IdP logout URL generation."""
        # Set up environment
        for key, value in self.env_vars.items():
            os.environ[key] = value

        # Mock SSM client
        def mock_get_parameter(Name, WithDecryption=True):
            return {"Parameter": {"Value": self.mock_ssm_responses[Name]}}

        mock_ssm_client.get_parameter.side_effect = mock_get_parameter

        # Mock session manager
        mock_session_manager = Mock()
        mock_session_manager.get_session.return_value = {
            "data": {
                "user": {"id": "test-user", "displayName": "Test User", "email": "test@example.com"},
                "session": {"provider": "oidc"},
            }
        }
        mock_session_manager.delete_session.return_value = True
        mock_session_manager_class.return_value = mock_session_manager

        # Mock OIDC handler
        mock_oidc_handler = Mock()
        mock_oidc_handler.get_logout_url.return_value = (
            "https://example.com/logout?post_logout_redirect_uri=https://app.example.com/"
        )
        mock_oidc_handler_class.return_value = mock_oidc_handler

        event = {
            "headers": {"Host": "app.example.com", "Cookie": "mlspace_session=session:test-session-id"},
            "body": json.dumps({"logoutFromIdp": True}),
        }

        response = logout(event, self.mock_context)

        # Verify response
        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["status"] == "LOGGED_OUT"
        assert "idpLogoutUrl" in body
        assert "https://example.com/logout" in body["idpLogoutUrl"]

        # Verify IdP logout URL was requested
        mock_oidc_handler.get_logout_url.assert_called_once_with("https://app.example.com/")

    def test_logout_no_session_cookie(self):
        """Test logout with no session cookie."""
        event = {
            "headers": {"Host": "app.example.com"},
            "body": json.dumps({"logoutFromIdp": False}),
        }

        response = logout(event, self.mock_context)

        # Should return error
        assert response["statusCode"] == 400
        body = json.loads(response["body"])
        assert body["error"] == "INVALID_SESSION"
        assert body["message"] == "No active session found"

    @patch.dict("os.environ")
    @patch("ml_space_lambda.auth.lambda_functions.ssm_client")
    @patch("ml_space_lambda.auth.lambda_functions.SessionManager")
    def test_logout_invalid_session(self, mock_session_manager_class, mock_ssm_client):
        """Test logout with invalid session."""
        # Set up environment
        for key, value in self.env_vars.items():
            os.environ[key] = value

        # Mock SSM client
        def mock_get_parameter(Name, WithDecryption=True):
            return {"Parameter": {"Value": self.mock_ssm_responses[Name]}}

        mock_ssm_client.get_parameter.side_effect = mock_get_parameter

        # Mock session manager to return None (invalid session)
        mock_session_manager = Mock()
        mock_session_manager.get_session.return_value = None
        mock_session_manager_class.return_value = mock_session_manager

        event = {
            "headers": {"Host": "app.example.com", "Cookie": "mlspace_session=session:invalid-session-id"},
            "body": json.dumps({"logoutFromIdp": False}),
        }

        response = logout(event, self.mock_context)

        # Should return error
        assert response["statusCode"] == 400
        body = json.loads(response["body"])
        assert body["error"] == "INVALID_SESSION"
        assert body["message"] == "No active session found"

    @patch.dict("os.environ")
    @patch("ml_space_lambda.auth.lambda_functions.ssm_client")
    @patch("ml_space_lambda.auth.lambda_functions.SessionManager")
    def test_logout_no_body(self, mock_session_manager_class, mock_ssm_client):
        """Test logout with no request body."""
        # Set up environment
        for key, value in self.env_vars.items():
            os.environ[key] = value

        # Mock SSM client
        def mock_get_parameter(Name, WithDecryption=True):
            return {"Parameter": {"Value": self.mock_ssm_responses[Name]}}

        mock_ssm_client.get_parameter.side_effect = mock_get_parameter

        # Mock session manager
        mock_session_manager = Mock()
        mock_session_manager.get_session.return_value = {
            "data": {
                "user": {"id": "test-user", "displayName": "Test User", "email": "test@example.com"},
                "session": {"provider": "oidc"},
            }
        }
        mock_session_manager.delete_session.return_value = True
        mock_session_manager_class.return_value = mock_session_manager

        event = {
            "headers": {"Host": "app.example.com", "Cookie": "mlspace_session=session:test-session-id"},
            # No body
        }

        response = logout(event, self.mock_context)

        # Should succeed with default behavior (no IdP logout)
        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["status"] == "LOGGED_OUT"
        assert "idpLogoutUrl" not in body

    @patch.dict("os.environ")
    @patch("ml_space_lambda.auth.lambda_functions.ssm_client")
    @patch("ml_space_lambda.auth.lambda_functions.SessionManager")
    def test_logout_session_deletion_failure(self, mock_session_manager_class, mock_ssm_client):
        """Test logout when session deletion fails."""
        # Set up environment
        for key, value in self.env_vars.items():
            os.environ[key] = value

        # Mock SSM client
        def mock_get_parameter(Name, WithDecryption=True):
            return {"Parameter": {"Value": self.mock_ssm_responses[Name]}}

        mock_ssm_client.get_parameter.side_effect = mock_get_parameter

        # Mock session manager
        mock_session_manager = Mock()
        mock_session_manager.get_session.return_value = {
            "data": {
                "user": {"id": "test-user", "displayName": "Test User", "email": "test@example.com"},
                "session": {"provider": "oidc"},
            }
        }
        mock_session_manager.delete_session.return_value = False  # Deletion fails
        mock_session_manager_class.return_value = mock_session_manager

        event = {
            "headers": {"Host": "app.example.com", "Cookie": "mlspace_session=session:test-session-id"},
            "body": json.dumps({"logoutFromIdp": False}),
        }

        response = logout(event, self.mock_context)

        # Should still succeed (logout continues even if deletion fails)
        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["status"] == "LOGGED_OUT"

        # Verify session cookie is still cleared
        assert "multiValueHeaders" in response
        assert "Set-Cookie" in response["multiValueHeaders"]

    @patch.dict("os.environ")
    @patch("ml_space_lambda.auth.lambda_functions.ssm_client")
    @patch("ml_space_lambda.auth.lambda_functions.SessionManager")
    def test_identity_success(self, mock_session_manager_class, mock_ssm_client):
        """Test successful identity request."""
        # Set up environment
        for key, value in self.env_vars.items():
            os.environ[key] = value

        # Mock SSM client
        def mock_get_parameter(Name, WithDecryption=True):
            return {"Parameter": {"Value": self.mock_ssm_responses[Name]}}

        mock_ssm_client.get_parameter.side_effect = mock_get_parameter

        # Mock session manager
        from datetime import datetime, timedelta, timezone

        future_time = datetime.now(timezone.utc) + timedelta(hours=1)
        refresh_time = datetime.now(timezone.utc) + timedelta(minutes=30)

        mock_session_data = {
            "data": {
                "user": {
                    "id": "test-user",
                    "displayName": "Test User",
                    "email": "test@example.com",
                    "groups": ["users", "admin"],
                    "attributes": {"department": "Engineering"},
                },
                "session": {"provider": "oidc", "expiresAt": future_time.isoformat(), "refreshAt": refresh_time.isoformat()},
            }
        }

        mock_session_manager = Mock()
        mock_session_manager.get_session.return_value = mock_session_data
        mock_session_manager_class.return_value = mock_session_manager

        event = {"headers": {"Host": "app.example.com", "Cookie": "mlspace_session=session:test-session-id"}}

        response = identity(event, self.mock_context)

        # Verify response
        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["status"] == "AUTHENTICATED"
        assert body["user"]["id"] == "test-user"
        assert body["user"]["displayName"] == "Test User"
        assert body["user"]["email"] == "test@example.com"
        assert body["user"]["groups"] == ["users", "admin"]
        assert body["user"]["attributes"] == {"department": "Engineering"}
        assert body["session"]["provider"] == "oidc"
        assert body["session"]["expiresAt"] == future_time.isoformat()
        assert body["session"]["refreshAt"] == refresh_time.isoformat()
        assert "refreshed" not in body["session"]

    def test_identity_no_session_cookie(self):
        """Test identity request with no session cookie."""
        event = {"headers": {"Host": "app.example.com"}}

        response = identity(event, self.mock_context)

        # Should return unauthenticated
        assert response["statusCode"] == 401
        body = json.loads(response["body"])
        assert body["status"] == "UNAUTHENTICATED"
        assert body["error"] == "NO_SESSION"
        assert body["message"] == "No session cookie found"

    @patch.dict("os.environ")
    @patch("ml_space_lambda.auth.lambda_functions.ssm_client")
    @patch("ml_space_lambda.auth.lambda_functions.SessionManager")
    def test_identity_invalid_session(self, mock_session_manager_class, mock_ssm_client):
        """Test identity request with invalid session."""
        # Set up environment
        for key, value in self.env_vars.items():
            os.environ[key] = value

        # Mock SSM client
        def mock_get_parameter(Name, WithDecryption=True):
            return {"Parameter": {"Value": self.mock_ssm_responses[Name]}}

        mock_ssm_client.get_parameter.side_effect = mock_get_parameter

        # Mock session manager to return None (invalid session)
        mock_session_manager = Mock()
        mock_session_manager.get_session.return_value = None
        mock_session_manager_class.return_value = mock_session_manager

        event = {"headers": {"Host": "app.example.com", "Cookie": "mlspace_session=session:invalid-session-id"}}

        response = identity(event, self.mock_context)

        # Should return unauthenticated
        assert response["statusCode"] == 401
        body = json.loads(response["body"])
        assert body["status"] == "UNAUTHENTICATED"
        assert body["error"] == "SESSION_EXPIRED"
        assert body["message"] == "Session has expired or is invalid"

    @patch.dict("os.environ")
    @patch("ml_space_lambda.auth.lambda_functions.ssm_client")
    @patch("ml_space_lambda.auth.lambda_functions.SessionManager")
    @patch("ml_space_lambda.auth.lambda_functions.OIDCHandler")
    def test_identity_with_token_refresh(self, mock_oidc_handler_class, mock_session_manager_class, mock_ssm_client):
        """Test identity request that triggers token refresh."""
        # Set up environment
        for key, value in self.env_vars.items():
            os.environ[key] = value

        # Mock SSM client
        def mock_get_parameter(Name, WithDecryption=True):
            return {"Parameter": {"Value": self.mock_ssm_responses[Name]}}

        mock_ssm_client.get_parameter.side_effect = mock_get_parameter

        # Mock session manager
        from datetime import datetime, timedelta, timezone

        future_time = datetime.now(timezone.utc) + timedelta(hours=1)
        # Set refresh time in the past to trigger refresh
        past_refresh_time = datetime.now(timezone.utc) - timedelta(minutes=5)

        mock_session_data = {
            "data": {
                "user": {
                    "id": "test-user",
                    "displayName": "Test User",
                    "email": "test@example.com",
                    "groups": ["users"],
                    "attributes": {},
                },
                "session": {
                    "provider": "oidc",
                    "expiresAt": future_time.isoformat(),
                    "refreshAt": past_refresh_time.isoformat(),
                    "refresh_token": "refresh-token-value",
                },
            }
        }

        # Updated session data after refresh
        updated_session_data = {
            "data": {
                "user": {
                    "id": "test-user",
                    "displayName": "Test User Updated",
                    "email": "test@example.com",
                    "groups": ["users", "premium"],
                    "attributes": {},
                },
                "session": {
                    "provider": "oidc",
                    "expiresAt": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
                    "refreshAt": (datetime.now(timezone.utc) + timedelta(minutes=55)).isoformat(),
                    "refresh_token": "new-refresh-token-value",
                },
            }
        }

        mock_session_manager = Mock()
        # First call returns original data, second call returns updated data
        mock_session_manager.get_session.side_effect = [mock_session_data, updated_session_data]
        mock_session_manager.refresh_session_with_user_data.return_value = True
        mock_session_manager_class.return_value = mock_session_manager

        # Mock OIDC handler for token refresh
        from ml_space_lambda.auth.models.auth_models import AuthenticationResult, IdPTokens, UserData

        mock_user_data = UserData(
            id="test-user",
            displayName="Test User Updated",
            email="test@example.com",
            groups=["users", "premium"],
            attributes={},
        )

        mock_tokens = IdPTokens(
            access_token="new-access-token", refresh_token="new-refresh-token", id_token="new-id-token", expires_in=3600
        )

        mock_refresh_result = AuthenticationResult(
            success=True, user_data=mock_user_data, tokens=mock_tokens, raw_response="new-raw-response"
        )

        mock_oidc_handler = Mock()
        mock_oidc_handler.refresh_tokens.return_value = mock_refresh_result
        mock_oidc_handler.extract_token_expiration.return_value = (3600, 86400)
        mock_oidc_handler_class.return_value = mock_oidc_handler

        event = {"headers": {"Host": "app.example.com", "Cookie": "mlspace_session=session:test-session-id"}}

        response = identity(event, self.mock_context)

        # Verify response
        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["status"] == "AUTHENTICATED"
        assert body["user"]["displayName"] == "Test User Updated"
        assert body["user"]["groups"] == ["users", "premium"]
        assert body["session"]["provider"] == "oidc"
        assert body["session"]["refreshed"] is True

        # Verify token refresh was called
        mock_oidc_handler.refresh_tokens.assert_called_once_with("refresh-token-value")

        # Verify session was updated
        mock_session_manager.refresh_session_with_user_data.assert_called_once()

        # Verify new session cookie is set
        assert "multiValueHeaders" in response
        assert "Set-Cookie" in response["multiValueHeaders"]

    @patch.dict("os.environ")
    @patch("ml_space_lambda.auth.lambda_functions.ssm_client")
    @patch("ml_space_lambda.auth.lambda_functions.SessionManager")
    @patch("ml_space_lambda.auth.lambda_functions.OIDCHandler")
    def test_identity_refresh_failure(self, mock_oidc_handler_class, mock_session_manager_class, mock_ssm_client):
        """Test identity request when token refresh fails."""
        # Set up environment
        for key, value in self.env_vars.items():
            os.environ[key] = value

        # Mock SSM client
        def mock_get_parameter(Name, WithDecryption=True):
            return {"Parameter": {"Value": self.mock_ssm_responses[Name]}}

        mock_ssm_client.get_parameter.side_effect = mock_get_parameter

        # Mock session manager
        from datetime import datetime, timedelta, timezone

        future_time = datetime.now(timezone.utc) + timedelta(hours=1)
        # Set refresh time in the past to trigger refresh
        past_refresh_time = datetime.now(timezone.utc) - timedelta(minutes=5)

        mock_session_data = {
            "data": {
                "user": {
                    "id": "test-user",
                    "displayName": "Test User",
                    "email": "test@example.com",
                    "groups": ["users"],
                    "attributes": {},
                },
                "session": {
                    "provider": "oidc",
                    "expiresAt": future_time.isoformat(),
                    "refreshAt": past_refresh_time.isoformat(),
                    "refresh_token": "refresh-token-value",
                },
            }
        }

        mock_session_manager = Mock()
        mock_session_manager.get_session.return_value = mock_session_data
        mock_session_manager_class.return_value = mock_session_manager

        # Mock OIDC handler for failed token refresh
        from ml_space_lambda.auth.models.auth_models import AuthenticationResult

        mock_refresh_result = AuthenticationResult(success=False, error="Token refresh failed")

        mock_oidc_handler = Mock()
        mock_oidc_handler.refresh_tokens.return_value = mock_refresh_result
        mock_oidc_handler_class.return_value = mock_oidc_handler

        event = {"headers": {"Host": "app.example.com", "Cookie": "mlspace_session=session:test-session-id"}}

        response = identity(event, self.mock_context)

        # Should still return authenticated with original session data
        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["status"] == "AUTHENTICATED"
        assert body["user"]["id"] == "test-user"
        assert body["user"]["displayName"] == "Test User"
        assert "refreshed" not in body["session"]

        # Verify token refresh was attempted
        mock_oidc_handler.refresh_tokens.assert_called_once_with("refresh-token-value")

    @patch.dict("os.environ")
    @patch("ml_space_lambda.auth.lambda_functions.ssm_client")
    @patch("ml_space_lambda.auth.lambda_functions.SessionManager")
    def test_identity_no_refresh_token(self, mock_session_manager_class, mock_ssm_client):
        """Test identity request when refresh is needed but no refresh token available."""
        # Set up environment
        for key, value in self.env_vars.items():
            os.environ[key] = value

        # Mock SSM client
        def mock_get_parameter(Name, WithDecryption=True):
            return {"Parameter": {"Value": self.mock_ssm_responses[Name]}}

        mock_ssm_client.get_parameter.side_effect = mock_get_parameter

        # Mock session manager
        from datetime import datetime, timedelta, timezone

        future_time = datetime.now(timezone.utc) + timedelta(hours=1)
        # Set refresh time in the past to trigger refresh
        past_refresh_time = datetime.now(timezone.utc) - timedelta(minutes=5)

        mock_session_data = {
            "data": {
                "user": {
                    "id": "test-user",
                    "displayName": "Test User",
                    "email": "test@example.com",
                    "groups": ["users"],
                    "attributes": {},
                },
                "session": {
                    "provider": "oidc",
                    "expiresAt": future_time.isoformat(),
                    "refreshAt": past_refresh_time.isoformat(),
                    # No refresh_token
                },
            }
        }

        mock_session_manager = Mock()
        mock_session_manager.get_session.return_value = mock_session_data
        mock_session_manager_class.return_value = mock_session_manager

        event = {"headers": {"Host": "app.example.com", "Cookie": "mlspace_session=session:test-session-id"}}

        response = identity(event, self.mock_context)

        # Should still return authenticated with original session data
        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["status"] == "AUTHENTICATED"
        assert body["user"]["id"] == "test-user"
        assert "refreshed" not in body["session"]

    @patch.dict("os.environ")
    @patch("ml_space_lambda.auth.lambda_functions.ssm_client")
    @patch("ml_space_lambda.auth.lambda_functions.OTACManager")
    def test_sync_success_end_of_chain(self, mock_otac_manager_class, mock_ssm_client):
        """Test successful sync request at end of chain."""
        # Set up environment
        for key, value in self.env_vars.items():
            os.environ[key] = value

        # Mock SSM client
        def mock_get_parameter(Name, WithDecryption=True):
            return {"Parameter": {"Value": self.mock_ssm_responses[Name]}}

        mock_ssm_client.get_parameter.side_effect = mock_get_parameter

        # Mock OTAC manager
        mock_otac_data = {
            "sessionId": "session:test-session-id",
            "remainingDomains": [],  # End of chain
            "finalRedirectUrl": "/dashboard",
            "usedAt": None,
        }

        mock_otac_manager = Mock()
        mock_otac_manager.validate_and_consume_otac.return_value = mock_otac_data
        mock_otac_manager_class.return_value = mock_otac_manager

        event = {
            "headers": {"Host": "api.example.com"},
            "queryStringParameters": {
                "otac": "otac:valid-otac-code",
                "final": "/dashboard",
            },
        }

        from ml_space_lambda.auth.lambda_functions import sync

        response = sync(event, self.mock_context)

        # Verify response
        assert response["statusCode"] == 302
        assert response["headers"]["Location"] == "/dashboard"
        assert "multiValueHeaders" in response
        assert "Set-Cookie" in response["multiValueHeaders"]

        # Verify session cookie is set
        cookies = response["multiValueHeaders"]["Set-Cookie"]
        session_cookie = next((c for c in cookies if "mlspace_session" in c), None)
        assert session_cookie is not None
        assert "session:test-session-id" in session_cookie
        assert "HttpOnly" in session_cookie
        assert "Secure" in session_cookie

        # Verify OTAC validation was called
        mock_otac_manager.validate_and_consume_otac.assert_called_once_with("otac:valid-otac-code")

    @patch.dict("os.environ")
    @patch("ml_space_lambda.auth.lambda_functions.ssm_client")
    @patch("ml_space_lambda.auth.lambda_functions.OTACManager")
    def test_sync_success_continue_chain(self, mock_otac_manager_class, mock_ssm_client):
        """Test successful sync request that continues the chain."""
        # Set up environment
        for key, value in self.env_vars.items():
            os.environ[key] = value

        # Mock SSM client
        def mock_get_parameter(Name, WithDecryption=True):
            return {"Parameter": {"Value": self.mock_ssm_responses[Name]}}

        mock_ssm_client.get_parameter.side_effect = mock_get_parameter

        # Mock OTAC manager
        mock_otac_data = {
            "sessionId": "session:test-session-id",
            "remainingDomains": ["notebooks.example.com"],  # More domains to sync
            "finalRedirectUrl": "/dashboard",
            "usedAt": None,
        }

        mock_otac_manager = Mock()
        mock_otac_manager.validate_and_consume_otac.return_value = mock_otac_data
        mock_otac_manager.create_otac.return_value = "otac:next-otac-code"
        mock_otac_manager_class.return_value = mock_otac_manager

        event = {
            "headers": {"Host": "api.example.com"},
            "queryStringParameters": {
                "otac": "otac:valid-otac-code",
                "next": "notebooks.example.com",
                "final": "/dashboard",
            },
        }

        from ml_space_lambda.auth.lambda_functions import sync

        response = sync(event, self.mock_context)

        # Verify response
        assert response["statusCode"] == 302
        assert "notebooks.example.com" in response["headers"]["Location"]
        assert "otac=otac%3Anext-otac-code" in response["headers"]["Location"]  # URL encoded
        assert "final=%2Fdashboard" in response["headers"]["Location"]

        # Verify session cookie is set
        assert "multiValueHeaders" in response
        assert "Set-Cookie" in response["multiValueHeaders"]
        cookies = response["multiValueHeaders"]["Set-Cookie"]
        session_cookie = next((c for c in cookies if "mlspace_session" in c), None)
        assert session_cookie is not None

        # Verify OTAC operations
        mock_otac_manager.validate_and_consume_otac.assert_called_once_with("otac:valid-otac-code")
        mock_otac_manager.create_otac.assert_called_once_with(
            session_id="session:test-session-id",
            remaining_domains=[],  # notebooks.example.com removed from list
            final_redirect_url="/dashboard",
        )

    def test_sync_missing_otac(self):
        """Test sync request with missing OTAC."""
        event = {
            "headers": {"Host": "api.example.com"},
            "queryStringParameters": {
                "final": "/dashboard",
                # Missing "otac"
            },
        }

        from ml_space_lambda.auth.lambda_functions import sync

        response = sync(event, self.mock_context)

        # Should redirect with error
        assert response["statusCode"] == 302
        assert "error=invalid_otac" in response["headers"]["Location"]

    def test_sync_invalid_otac_format(self):
        """Test sync request with invalid OTAC format."""
        event = {
            "headers": {"Host": "api.example.com"},
            "queryStringParameters": {
                "otac": "invalid-otac-format",
                "final": "/dashboard",
            },
        }

        from ml_space_lambda.auth.lambda_functions import sync

        response = sync(event, self.mock_context)

        # Should redirect with error
        assert response["statusCode"] == 302
        assert "error=invalid_otac" in response["headers"]["Location"]

    def test_sync_missing_final_url(self):
        """Test sync request with missing final redirect URL."""
        event = {
            "headers": {"Host": "api.example.com"},
            "queryStringParameters": {
                "otac": "otac:valid-otac-code",
                # Missing "final"
            },
        }

        from ml_space_lambda.auth.lambda_functions import sync

        response = sync(event, self.mock_context)

        # Should redirect with error
        assert response["statusCode"] == 302
        assert "error=invalid_request" in response["headers"]["Location"]

    @patch.dict("os.environ")
    @patch("ml_space_lambda.auth.lambda_functions.ssm_client")
    def test_sync_missing_host_header(self, mock_ssm_client):
        """Test sync request with missing Host header."""
        # Set up environment
        for key, value in self.env_vars.items():
            os.environ[key] = value

        # Mock SSM client
        def mock_get_parameter(Name, WithDecryption=True):
            return {"Parameter": {"Value": self.mock_ssm_responses[Name]}}

        mock_ssm_client.get_parameter.side_effect = mock_get_parameter

        event = {
            "headers": {},  # Missing Host header
            "queryStringParameters": {
                "otac": "otac:valid-otac-code",
                "final": "/dashboard",
            },
        }

        from ml_space_lambda.auth.lambda_functions import sync

        response = sync(event, self.mock_context)

        # Should redirect with error
        assert response["statusCode"] == 302
        assert "error=invalid_request" in response["headers"]["Location"]

    @patch.dict("os.environ")
    @patch("ml_space_lambda.auth.lambda_functions.ssm_client")
    @patch("ml_space_lambda.auth.lambda_functions.OTACManager")
    def test_sync_invalid_otac(self, mock_otac_manager_class, mock_ssm_client):
        """Test sync request with invalid/expired OTAC."""
        # Set up environment
        for key, value in self.env_vars.items():
            os.environ[key] = value

        # Mock SSM client
        def mock_get_parameter(Name, WithDecryption=True):
            return {"Parameter": {"Value": self.mock_ssm_responses[Name]}}

        mock_ssm_client.get_parameter.side_effect = mock_get_parameter

        # Mock OTAC manager to return None (invalid OTAC)
        mock_otac_manager = Mock()
        mock_otac_manager.validate_and_consume_otac.return_value = None
        mock_otac_manager_class.return_value = mock_otac_manager

        event = {
            "headers": {"Host": "api.example.com"},
            "queryStringParameters": {
                "otac": "otac:invalid-otac-code",
                "final": "/dashboard",
            },
        }

        from ml_space_lambda.auth.lambda_functions import sync

        response = sync(event, self.mock_context)

        # Should redirect with error
        assert response["statusCode"] == 302
        assert "error=invalid_otac" in response["headers"]["Location"]
        assert "Authentication code is invalid or expired" in response["headers"]["Location"]

        # Verify OTAC validation was attempted
        mock_otac_manager.validate_and_consume_otac.assert_called_once_with("otac:invalid-otac-code")

    @patch.dict("os.environ")
    @patch("ml_space_lambda.auth.lambda_functions.ssm_client")
    @patch("ml_space_lambda.auth.lambda_functions.OTACManager")
    def test_sync_otac_creation_failure(self, mock_otac_manager_class, mock_ssm_client):
        """Test sync request when OTAC creation for next domain fails."""
        # Set up environment
        for key, value in self.env_vars.items():
            os.environ[key] = value

        # Mock SSM client
        def mock_get_parameter(Name, WithDecryption=True):
            return {"Parameter": {"Value": self.mock_ssm_responses[Name]}}

        mock_ssm_client.get_parameter.side_effect = mock_get_parameter

        # Mock OTAC manager
        mock_otac_data = {
            "sessionId": "session:test-session-id",
            "remainingDomains": ["notebooks.example.com"],
            "finalRedirectUrl": "/dashboard",
            "usedAt": None,
        }

        mock_otac_manager = Mock()
        mock_otac_manager.validate_and_consume_otac.return_value = mock_otac_data
        mock_otac_manager.create_otac.side_effect = Exception("OTAC creation failed")
        mock_otac_manager_class.return_value = mock_otac_manager

        event = {
            "headers": {"Host": "api.example.com"},
            "queryStringParameters": {
                "otac": "otac:valid-otac-code",
                "next": "notebooks.example.com",
                "final": "/dashboard",
            },
        }

        from ml_space_lambda.auth.lambda_functions import sync

        response = sync(event, self.mock_context)

        # Should redirect with error
        assert response["statusCode"] == 302
        assert "error=sync_failed" in response["headers"]["Location"]
        assert "Failed to continue synchronization" in response["headers"]["Location"]

    @patch.dict("os.environ")
    def test_sync_unauthorized_domain(self):
        """Test sync request from unauthorized domain."""
        # Set up environment with specific sync domains
        env_vars = self.env_vars.copy()
        env_vars["AUTH_SYNC_DOMAINS"] = "api.example.com,notebooks.example.com"
        env_vars["AUTH_PRIMARY_DOMAIN"] = "app.example.com"

        for key, value in env_vars.items():
            os.environ[key] = value

        event = {
            "headers": {"Host": "unauthorized.example.com"},  # Not in allowed domains
            "queryStringParameters": {
                "otac": "otac:valid-otac-code",
                "final": "/dashboard",
            },
        }

        from ml_space_lambda.auth.lambda_functions import sync

        response = sync(event, self.mock_context)

        # Should redirect with error
        assert response["statusCode"] == 302
        assert "error=unauthorized_domain" in response["headers"]["Location"]

    @patch.dict("os.environ")
    @patch("ml_space_lambda.auth.lambda_functions.ssm_client")
    def test_sync_configuration_error(self, mock_ssm_client):
        """Test sync request with configuration error."""
        # Set up environment with missing required config
        env_vars = self.env_vars.copy()
        env_vars["AUTH_SESSION_TABLE_NAME"] = ""  # Missing required config

        for key, value in env_vars.items():
            os.environ[key] = value

        event = {
            "headers": {"Host": "api.example.com"},
            "queryStringParameters": {
                "otac": "otac:valid-otac-code",
                "final": "/dashboard",
            },
        }

        from ml_space_lambda.auth.lambda_functions import sync

        response = sync(event, self.mock_context)

        # Should redirect with error
        assert response["statusCode"] == 302
        assert "error=sync_failed" in response["headers"]["Location"]
