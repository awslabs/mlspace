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

    def test_create_session_success(self):
        """Test successful session creation."""
        # Setup
        key = create_encryption_key()
        encryption = TokenEncryption(key)
        mock_store = Mock()
        manager = SessionManager("test-table", encryption)
        manager.store = mock_store

        user_data = {"id": "user123", "displayName": "Test User", "email": "test@example.com", "groups": [], "attributes": {}}
        tokens = {"access_token": "access123", "refresh_token": "refresh123", "id_token": "id123"}
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        refresh_at = datetime.now(timezone.utc) + timedelta(minutes=50)

        # Test
        session_id = manager.create_session(
            user_data=user_data,
            tokens=tokens,
            provider="oidc",
            expires_at=expires_at,
            refresh_at=refresh_at,
            login_domain="example.com",
            synced_domains=["example.com"],
            raw_idp_response="base64_encoded_response",
        )

        # Verify
        assert session_id.startswith("session:")
        mock_store._create.assert_called_once()

        # Check the session record structure
        call_args = mock_store._create.call_args
        session_record = call_args[0][0]
        assert session_record["pk"] == session_id
        assert "ttl" in session_record
        assert session_record["data"]["user"] == user_data
        assert session_record["data"]["session"]["provider"] == "oidc"
        assert "refresh_token" in session_record["data"]["session"]
        assert session_record["raw_data"] == "base64_encoded_response"

    def test_create_session_without_optional_fields(self):
        """Test session creation without optional fields."""
        # Setup
        key = create_encryption_key()
        encryption = TokenEncryption(key)
        mock_store = Mock()
        manager = SessionManager("test-table", encryption)
        manager.store = mock_store

        user_data = {"id": "user123", "displayName": "Test User", "email": "test@example.com"}
        tokens = {"refresh_token": "refresh123"}
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        refresh_at = datetime.now(timezone.utc) + timedelta(minutes=50)

        # Test
        session_id = manager.create_session(
            user_data=user_data,
            tokens=tokens,
            provider="oidc",
            expires_at=expires_at,
            refresh_at=refresh_at,
            login_domain="example.com",
        )

        # Verify
        assert session_id.startswith("session:")
        call_args = mock_store._create.call_args
        session_record = call_args[0][0]
        assert "raw_data" not in session_record
        assert session_record["data"]["metadata"]["syncedDomains"] == []

    def test_create_session_failure(self):
        """Test session creation failure."""
        # Setup
        key = create_encryption_key()
        encryption = TokenEncryption(key)
        mock_store = Mock()
        mock_store._create.side_effect = Exception("DynamoDB error")
        manager = SessionManager("test-table", encryption)
        manager.store = mock_store

        user_data = {"id": "user123", "displayName": "Test User", "email": "test@example.com"}
        tokens = {"refresh_token": "refresh123"}
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        refresh_at = datetime.now(timezone.utc) + timedelta(minutes=50)

        # Test
        try:
            manager.create_session(
                user_data=user_data,
                tokens=tokens,
                provider="oidc",
                expires_at=expires_at,
                refresh_at=refresh_at,
                login_domain="example.com",
            )
            assert False, "Should have raised exception"
        except Exception as e:
            assert "Failed to create session" in str(e)

    def test_get_session_success(self):
        """Test successful session retrieval."""
        # Setup
        key = create_encryption_key()
        encryption = TokenEncryption(key)
        mock_store = Mock()
        manager = SessionManager("test-table", encryption)
        manager.store = mock_store

        session_id = "session:test123"
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        encrypted_token = encryption.encrypt_token("refresh123")

        mock_session_record = {
            "pk": session_id,
            "ttl": int((datetime.now(timezone.utc) + timedelta(hours=2)).timestamp()),
            "data": {
                "user": {"id": "user123", "displayName": "Test User", "email": "test@example.com"},
                "session": {
                    "provider": "oidc",
                    "expiresAt": expires_at.isoformat(),
                    "refreshAt": expires_at.isoformat(),
                    "refresh_token": encrypted_token,
                },
            },
        }
        mock_store._retrieve.return_value = mock_session_record

        # Test
        session_data = manager.get_session(session_id)

        # Verify
        assert session_data is not None
        assert session_data["data"]["user"]["id"] == "user123"
        assert "refresh_token" in session_data["data"]["session"]

    def test_get_session_invalid_id(self):
        """Test get_session with invalid session ID."""
        # Setup
        key = create_encryption_key()
        encryption = TokenEncryption(key)
        manager = SessionManager("test-table", encryption)

        # Test
        session_data = manager.get_session("invalid_id")

        # Verify
        assert session_data is None

    def test_get_session_none_id(self):
        """Test get_session with None session ID."""
        # Setup
        key = create_encryption_key()
        encryption = TokenEncryption(key)
        manager = SessionManager("test-table", encryption)

        # Test
        session_data = manager.get_session(None)

        # Verify
        assert session_data is None

    def test_get_session_expired_ttl(self):
        """Test get_session with expired TTL."""
        # Setup
        key = create_encryption_key()
        encryption = TokenEncryption(key)
        mock_store = Mock()
        manager = SessionManager("test-table", encryption)
        manager.store = mock_store

        session_id = "session:test123"
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

        mock_session_record = {
            "pk": session_id,
            "ttl": int((datetime.now(timezone.utc) - timedelta(hours=1)).timestamp()),  # Expired TTL
            "data": {
                "user": {"id": "user123"},
                "session": {"provider": "oidc", "expiresAt": expires_at.isoformat(), "refreshAt": expires_at.isoformat()},
            },
        }
        mock_store._retrieve.return_value = mock_session_record

        # Test
        session_data = manager.get_session(session_id)

        # Verify
        assert session_data is None

    def test_get_session_expired_session(self):
        """Test get_session with expired session timestamp."""
        # Setup
        key = create_encryption_key()
        encryption = TokenEncryption(key)
        mock_store = Mock()
        manager = SessionManager("test-table", encryption)
        manager.store = mock_store

        session_id = "session:test123"
        expires_at = datetime.now(timezone.utc) - timedelta(hours=1)  # Expired

        mock_session_record = {
            "pk": session_id,
            "ttl": int((datetime.now(timezone.utc) + timedelta(hours=2)).timestamp()),
            "data": {
                "user": {"id": "user123"},
                "session": {"provider": "oidc", "expiresAt": expires_at.isoformat(), "refreshAt": expires_at.isoformat()},
            },
        }
        mock_store._retrieve.return_value = mock_session_record

        # Test
        session_data = manager.get_session(session_id)

        # Verify
        assert session_data is None

    def test_get_session_not_found(self):
        """Test get_session when session doesn't exist."""
        # Setup
        key = create_encryption_key()
        encryption = TokenEncryption(key)
        mock_store = Mock()
        mock_store._retrieve.side_effect = Exception("Not found")
        manager = SessionManager("test-table", encryption)
        manager.store = mock_store

        # Test
        session_data = manager.get_session("session:test123")

        # Verify
        assert session_data is None

    def test_update_session_tokens(self):
        """Test updating session tokens."""
        # Setup
        key = create_encryption_key()
        encryption = TokenEncryption(key)
        mock_store = Mock()
        manager = SessionManager("test-table", encryption)
        manager.store = mock_store

        session_id = "session:test123"
        tokens = {"refresh_token": "new_refresh_token"}
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        refresh_at = datetime.now(timezone.utc) + timedelta(minutes=50)

        # Test
        result = manager.update_session_tokens(
            session_id=session_id, tokens=tokens, expires_at=expires_at, refresh_at=refresh_at
        )

        # Verify
        assert result is True
        mock_store._update.assert_called_once()

    def test_update_session_with_raw_idp_response(self):
        """Test updating session with raw IdP response."""
        # Setup
        key = create_encryption_key()
        encryption = TokenEncryption(key)
        mock_store = Mock()
        manager = SessionManager("test-table", encryption)
        manager.store = mock_store

        session_id = "session:test123"
        raw_idp_response = "base64_encoded_response"

        # Test
        result = manager.update_session(session_id=session_id, raw_idp_response=raw_idp_response)

        # Verify
        assert result is True
        call_args = mock_store._update.call_args
        update_expression = call_args[0][1]
        assert "raw_data" in update_expression

    def test_update_session_no_changes(self):
        """Test updating session with no actual changes."""
        # Setup
        key = create_encryption_key()
        encryption = TokenEncryption(key)
        mock_store = Mock()
        manager = SessionManager("test-table", encryption)
        manager.store = mock_store

        session_id = "session:test123"

        # Test - only timestamp will be updated
        result = manager.update_session(session_id=session_id)

        # Verify
        assert result is True

    def test_update_session_exception(self):
        """Test update_session when DynamoDB update fails."""
        # Setup
        key = create_encryption_key()
        encryption = TokenEncryption(key)
        mock_store = Mock()
        mock_store._update.side_effect = Exception("Update failed")
        manager = SessionManager("test-table", encryption)
        manager.store = mock_store

        session_id = "session:test123"
        user_data = {"displayName": "Updated Name"}

        # Test
        result = manager.update_session(session_id=session_id, user_data=user_data)

        # Verify
        assert result is False
