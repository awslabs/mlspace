#!/usr/bin/env python3
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

"""
Simple test to verify session cookie validation in the authorizer.
This is a basic functional test to ensure the session-based authorizer works.
"""

from datetime import datetime, timedelta, timezone
from unittest import mock

# Mock environment variables for session-based auth
TEST_SESSION_ENV = {
    "AWS_DEFAULT_REGION": "us-east-1",
    "AUTH_SESSION_TABLE_NAME": "test-session-table",
    "AUTH_TOKEN_ENCRYPTION_KEY_SSM_PARAM": "/test/encryption/key",
}


def test_session_cookie_validation():
    """Test that the authorizer correctly validates session cookies."""

    with mock.patch.dict("os.environ", TEST_SESSION_ENV, clear=True):
        # Import after setting environment variables
        from ml_space_lambda.authorizer.lambda_function import lambda_handler
        from ml_space_lambda.data_access_objects.user import UserModel
        from ml_space_lambda.enums import Permission

        # Mock user data
        mock_user = UserModel(
            username="test@example.com",
            email="test@example.com",
            display_name="Test User",
            suspended=False,
            permissions=[Permission.ADMIN],
        )

        # Mock session data
        mock_session_data = {
            "data": {
                "user": {
                    "id": "test@example.com",
                    "displayName": "Test User",
                    "email": "test@example.com",
                    "groups": ["admin"],
                    "attributes": {},
                },
                "session": {
                    "provider": "oidc",
                    "expiresAt": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
                    "refreshAt": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
                },
            }
        }

        # Test 1: No cookie header - should deny access
        event_no_cookie = {
            "resource": "/test-resource",
            "pathParameters": {},
            "httpMethod": "GET",
            "methodArn": "test-arn",
            "headers": {},
        }

        with mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao") as mock_user_dao:
            mock_user_dao.get.return_value = mock_user

            result = lambda_handler(event_no_cookie, {})

            assert result["principalId"] == "Unknown"
            assert result["policyDocument"]["Statement"][0]["Effect"] == "Deny"
            print("✓ Test 1 passed: No cookie header correctly denied")

        # Test 2: Valid session cookie - should allow access
        event_with_cookie = {
            "resource": "/current-user",
            "pathParameters": {},
            "httpMethod": "GET",
            "methodArn": "test-arn",
            "headers": {"cookie": "mlspace_session=session:test-session-id"},
        }

        with mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao") as mock_user_dao, mock.patch(
            "ml_space_lambda.authorizer.lambda_function._get_session_manager"
        ) as mock_get_session_manager:

            # Mock session manager
            mock_session_manager = mock.Mock()
            mock_session_manager.get_session.return_value = mock_session_data
            mock_get_session_manager.return_value = mock_session_manager

            # Mock user DAO
            mock_user_dao.get.return_value = mock_user

            result = lambda_handler(event_with_cookie, {})

            assert result["principalId"] == "test@example.com"
            assert result["policyDocument"]["Statement"][0]["Effect"] == "Allow"
            assert "user" in result["context"]
            print("✓ Test 2 passed: Valid session cookie correctly allowed")

        # Test 3: Invalid session cookie - should deny access
        with mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao") as mock_user_dao, mock.patch(
            "ml_space_lambda.authorizer.lambda_function._get_session_manager"
        ) as mock_get_session_manager:

            # Mock session manager to return None (invalid session)
            mock_session_manager = mock.Mock()
            mock_session_manager.get_session.return_value = None
            mock_get_session_manager.return_value = mock_session_manager

            # Mock user DAO
            mock_user_dao.get.return_value = mock_user

            result = lambda_handler(event_with_cookie, {})

            assert result["principalId"] == "Unknown"
            assert result["policyDocument"]["Statement"][0]["Effect"] == "Deny"
            print("✓ Test 3 passed: Invalid session cookie correctly denied")

        print("\n🎉 All session cookie validation tests passed!")


if __name__ == "__main__":
    test_session_cookie_validation()
