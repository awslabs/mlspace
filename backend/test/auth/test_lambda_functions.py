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

from ml_space_lambda.auth.lambda_functions import login


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
            "AUTH_OIDC_CLIENT_SECRET_SSM_PARAM": "/test/client-secret",
            "AUTH_STATE_ENCRYPTION_KEY_SSM_PARAM": "/test/state-key",
            "AUTH_OIDC_VERIFY_SSL": "true",
            "AUTH_PRIMARY_DOMAIN": "",
            "AUTH_SYNC_DOMAINS": "",
        }

        # Mock SSM responses
        # Generate a valid Fernet key for testing
        from cryptography.fernet import Fernet

        test_fernet_key = Fernet.generate_key().decode("utf-8")

        self.mock_ssm_responses = {
            "/test/client-secret": "test-client-secret",
            "/test/state-key": test_fernet_key,
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
    @patch("ml_space_lambda.auth.lambda_functions.ssm_client")
    @patch("ml_space_lambda.auth.lambda_functions.OIDCHandler")
    @patch("ml_space_lambda.auth.lambda_functions.StateManager")
    def test_login_success(self, mock_state_manager_class, mock_oidc_handler_class, mock_ssm_client):
        """Test successful login flow."""
        # Set up environment
        for key, value in self.env_vars.items():
            os.environ[key] = value

        # Mock SSM client
        def mock_get_parameter(Name, WithDecryption=True):
            return {"Parameter": {"Value": self.mock_ssm_responses[Name]}}

        mock_ssm_client.get_parameter.side_effect = mock_get_parameter

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
    @patch("ml_space_lambda.auth.lambda_functions.ssm_client")
    def test_login_invalid_redirect_url(self, mock_ssm_client):
        """Test login with invalid redirect URL."""
        # Set up environment
        for key, value in self.env_vars.items():
            os.environ[key] = value

        # Mock SSM client
        def mock_get_parameter(Name, WithDecryption=True):
            return {"Parameter": {"Value": self.mock_ssm_responses[Name]}}

        mock_ssm_client.get_parameter.side_effect = mock_get_parameter

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
    @patch("ml_space_lambda.auth.lambda_functions.ssm_client")
    def test_login_no_body(self, mock_ssm_client):
        """Test login with no request body."""
        # Set up environment
        for key, value in self.env_vars.items():
            os.environ[key] = value

        # Mock SSM client
        def mock_get_parameter(Name, WithDecryption=True):
            return {"Parameter": {"Value": self.mock_ssm_responses[Name]}}

        mock_ssm_client.get_parameter.side_effect = mock_get_parameter

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
