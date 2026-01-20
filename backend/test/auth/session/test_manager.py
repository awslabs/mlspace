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

from datetime import datetime, timedelta, timezone
from unittest.mock import Mock

from ml_space_lambda.auth.session.encryption import TokenEncryption, create_encryption_key
from ml_space_lambda.auth.session.manager import SessionManager


class TestSessionManager:
    """Test session manager functionality."""

    def test_update_session_user_data_only(self):
        """Test updating only user data without tokens."""
        # Setup
        key = create_encryption_key()
        encryption = TokenEncryption(key)
        mock_store = Mock()
        manager = SessionManager("test-table", encryption)
        manager.store = mock_store  # Replace the store with our mock

        session_id = "session:test123"
        new_user_data = {"displayName": "Updated Name", "email": "new@example.com", "groups": ["admin", "users"]}

        # Test
        result = manager.update_session(session_id=session_id, user_data=new_user_data)

        # Verify
        assert result is True
        mock_store._update.assert_called_once()

        # Check that update was called with the right parameters
        call_args = mock_store._update.call_args
        # Arguments are: (key, update_expression, condition_expression, expression_names, expression_values)
        update_expression = call_args[0][1]  # Second positional argument

        assert "displayName" in update_expression
        assert "email" in update_expression
        assert "groups" in update_expression

    def test_refresh_session_with_user_data(self):
        """Test refreshing session with both tokens and user data."""
        # Setup
        key = create_encryption_key()
        encryption = TokenEncryption(key)
        mock_store = Mock()
        manager = SessionManager("test-table", encryption)
        manager.store = mock_store  # Replace the store with our mock

        session_id = "session:test123"
        new_tokens = {"access_token": "new_access_token", "refresh_token": "new_refresh_token", "id_token": "new_id_token"}
        new_user_data = {"displayName": "Updated Name", "email": "updated@example.com"}
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        refresh_at = datetime.now(timezone.utc) + timedelta(minutes=50)

        # Test
        result = manager.refresh_session_with_user_data(
            session_id=session_id, tokens=new_tokens, user_data=new_user_data, expires_at=expires_at, refresh_at=refresh_at
        )

        # Verify
        assert result is True
        mock_store._update.assert_called_once()

        # Check that update was called with the right parameters
        call_args = mock_store._update.call_args
        update_expression = call_args[0][1]  # Second positional argument

        # Should have refresh_token (only token stored), user data, and timestamp updates
        assert "refresh_token" in update_expression
        assert "displayName" in update_expression
        assert "expires_at" in update_expression
        # access_token and id_token should NOT be in the update expression (not stored)
        assert "access_token" not in update_expression
        assert "id_token" not in update_expression

    def test_update_session_invalid_session_id(self):
        """Test updating session with invalid session ID."""
        # Setup
        key = create_encryption_key()
        encryption = TokenEncryption(key)
        mock_store = Mock()
        manager = SessionManager("test-table", encryption)
        manager.store = mock_store  # Replace the store with our mock

        # Test with invalid session ID
        result = manager.update_session(session_id="invalid_id", user_data={"displayName": "Test"})

        # Verify
        assert result is False
        mock_store._update.assert_not_called()
