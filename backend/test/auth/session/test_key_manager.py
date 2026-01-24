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
Tests for versioned key manager.
"""

import json
from unittest.mock import Mock, patch

import pytest
from cryptography.fernet import Fernet

from ml_space_lambda.auth.session.encryption import create_encryption_key, encode_key_for_storage
from ml_space_lambda.auth.session.key_manager import VersionedKeyManager, VersionedStateManager, VersionedTokenEncryption


class TestVersionedKeyManager:
    """Tests for VersionedKeyManager class."""

    def test_init(self):
        """Test key manager initialization."""
        with patch("boto3.client"):
            manager = VersionedKeyManager("arn:aws:secretsmanager:us-east-1:123456789012:secret:test", key_type="token")

            assert manager.secret_arn == "arn:aws:secretsmanager:us-east-1:123456789012:secret:test"
            assert manager.key_type == "token"
            assert manager._keys_cache is None

    @patch("boto3.client")
    def test_load_keys_success(self, mock_boto_client):
        """Test successful key loading from Secrets Manager."""
        # Create test keys
        key1 = create_encryption_key()
        key2 = create_encryption_key()

        secret_data = {
            "current_version": 2,
            "keys": {"1": encode_key_for_storage(key1), "2": encode_key_for_storage(key2)},
            "rotation_date": "2024-01-15T10:30:00Z",
        }

        mock_secrets_client = Mock()
        mock_secrets_client.get_secret_value.return_value = {"SecretString": json.dumps(secret_data)}
        mock_boto_client.return_value = mock_secrets_client

        manager = VersionedKeyManager("arn:aws:secretsmanager:us-east-1:123456789012:secret:test")

        keys_data = manager._load_keys()

        assert keys_data["current_version"] == 2
        assert "1" in keys_data["keys"]
        assert "2" in keys_data["keys"]
        mock_secrets_client.get_secret_value.assert_called_once()

    @patch("boto3.client")
    def test_load_keys_caching(self, mock_boto_client):
        """Test that keys are cached after first load."""
        key1 = create_encryption_key()

        secret_data = {"current_version": 1, "keys": {"1": encode_key_for_storage(key1)}}

        mock_secrets_client = Mock()
        mock_secrets_client.get_secret_value.return_value = {"SecretString": json.dumps(secret_data)}
        mock_boto_client.return_value = mock_secrets_client

        manager = VersionedKeyManager("arn:aws:secretsmanager:us-east-1:123456789012:secret:test")

        # Load keys twice
        keys_data1 = manager._load_keys()
        keys_data2 = manager._load_keys()

        # Should only call Secrets Manager once due to caching
        assert mock_secrets_client.get_secret_value.call_count == 1
        assert keys_data1 == keys_data2

    @patch("boto3.client")
    def test_load_keys_failure(self, mock_boto_client):
        """Test key loading failure."""
        mock_secrets_client = Mock()
        mock_secrets_client.get_secret_value.side_effect = Exception("Secrets Manager error")
        mock_boto_client.return_value = mock_secrets_client

        manager = VersionedKeyManager("arn:aws:secretsmanager:us-east-1:123456789012:secret:test")

        with pytest.raises(Exception, match="Key loading failed"):
            manager._load_keys()

    @patch("boto3.client")
    def test_get_current_key_success(self, mock_boto_client):
        """Test getting current encryption key."""
        key1 = create_encryption_key()
        key2 = create_encryption_key()

        secret_data = {"current_version": 2, "keys": {"1": encode_key_for_storage(key1), "2": encode_key_for_storage(key2)}}

        mock_secrets_client = Mock()
        mock_secrets_client.get_secret_value.return_value = {"SecretString": json.dumps(secret_data)}
        mock_boto_client.return_value = mock_secrets_client

        manager = VersionedKeyManager("arn:aws:secretsmanager:us-east-1:123456789012:secret:test")

        version, key = manager.get_current_key()

        assert version == 2
        assert key == key2

    @patch("boto3.client")
    def test_get_current_key_missing_version(self, mock_boto_client):
        """Test getting current key when version is missing."""
        key1 = create_encryption_key()

        secret_data = {
            "current_version": 2,  # Says version 2 is current
            "keys": {"1": encode_key_for_storage(key1)},  # But only version 1 exists
        }

        mock_secrets_client = Mock()
        mock_secrets_client.get_secret_value.return_value = {"SecretString": json.dumps(secret_data)}
        mock_boto_client.return_value = mock_secrets_client

        manager = VersionedKeyManager("arn:aws:secretsmanager:us-east-1:123456789012:secret:test")

        with pytest.raises(Exception, match="Current key version 2 not found"):
            manager.get_current_key()

    @patch("boto3.client")
    def test_get_key_by_version_success(self, mock_boto_client):
        """Test getting specific key version."""
        key1 = create_encryption_key()
        key2 = create_encryption_key()

        secret_data = {"current_version": 2, "keys": {"1": encode_key_for_storage(key1), "2": encode_key_for_storage(key2)}}

        mock_secrets_client = Mock()
        mock_secrets_client.get_secret_value.return_value = {"SecretString": json.dumps(secret_data)}
        mock_boto_client.return_value = mock_secrets_client

        manager = VersionedKeyManager("arn:aws:secretsmanager:us-east-1:123456789012:secret:test")

        # Get version 1
        key = manager.get_key_by_version(1)
        assert key == key1

        # Get version 2
        key = manager.get_key_by_version(2)
        assert key == key2

    @patch("boto3.client")
    def test_get_key_by_version_not_found(self, mock_boto_client):
        """Test getting non-existent key version returns None."""
        key1 = create_encryption_key()

        secret_data = {"current_version": 1, "keys": {"1": encode_key_for_storage(key1)}}

        mock_secrets_client = Mock()
        mock_secrets_client.get_secret_value.return_value = {"SecretString": json.dumps(secret_data)}
        mock_boto_client.return_value = mock_secrets_client

        manager = VersionedKeyManager("arn:aws:secretsmanager:us-east-1:123456789012:secret:test")

        result = manager.get_key_by_version(99)
        assert result is None

    @patch("boto3.client")
    def test_get_all_versions_success(self, mock_boto_client):
        """Test getting all key versions."""
        key1 = create_encryption_key()
        key2 = create_encryption_key()
        key3 = create_encryption_key()

        secret_data = {
            "current_version": 3,
            "keys": {"1": encode_key_for_storage(key1), "2": encode_key_for_storage(key2), "3": encode_key_for_storage(key3)},
        }

        mock_secrets_client = Mock()
        mock_secrets_client.get_secret_value.return_value = {"SecretString": json.dumps(secret_data)}
        mock_boto_client.return_value = mock_secrets_client

        manager = VersionedKeyManager("arn:aws:secretsmanager:us-east-1:123456789012:secret:test")

        versions = manager.get_all_keys()

        assert len(versions) == 3
        assert 1 in versions
        assert 2 in versions
        assert 3 in versions
        assert isinstance(versions[1], bytes)
        assert isinstance(versions[2], bytes)
        assert isinstance(versions[3], bytes)

    @patch("boto3.client")
    def test_clear_cache(self, mock_boto_client):
        """Test cache clearing."""
        key1 = create_encryption_key()

        secret_data = {"current_version": 1, "keys": {"1": encode_key_for_storage(key1)}}

        mock_secrets_client = Mock()
        mock_secrets_client.get_secret_value.return_value = {"SecretString": json.dumps(secret_data)}
        mock_boto_client.return_value = mock_secrets_client

        manager = VersionedKeyManager("arn:aws:secretsmanager:us-east-1:123456789012:secret:test")

        # Load keys to populate cache
        manager._load_keys()
        assert manager._keys_cache is not None

        # Clear cache
        manager.invalidate_cache()
        assert manager._keys_cache is None

        # Next load should call Secrets Manager again
        manager._load_keys()
        assert mock_secrets_client.get_secret_value.call_count == 2


class TestVersionedTokenEncryption:
    """Tests for VersionedTokenEncryption class."""

    @patch("boto3.client")
    def test_encrypt_decrypt_token(self, mock_boto_client):
        """Test encrypting and decrypting tokens with versioned keys."""
        key1 = create_encryption_key()

        secret_data = {"current_version": 1, "keys": {"1": encode_key_for_storage(key1)}}

        mock_secrets_client = Mock()
        mock_secrets_client.get_secret_value.return_value = {"SecretString": json.dumps(secret_data)}
        mock_boto_client.return_value = mock_secrets_client

        key_manager = VersionedKeyManager("arn:aws:secretsmanager:us-east-1:123456789012:secret:test")
        token_encryption = VersionedTokenEncryption(key_manager)

        # Encrypt a token
        original_token = "test-access-token-12345"
        encrypted = token_encryption.encrypt_token(original_token)

        # Verify format
        assert encrypted.startswith("v1:")

        # Decrypt the token
        decrypted = token_encryption.decrypt_token(encrypted)
        assert decrypted == original_token

    @patch("boto3.client")
    def test_decrypt_with_old_key_version(self, mock_boto_client):
        """Test decrypting tokens encrypted with older key versions."""
        key1 = create_encryption_key()
        key2 = create_encryption_key()

        secret_data = {"current_version": 2, "keys": {"1": encode_key_for_storage(key1), "2": encode_key_for_storage(key2)}}

        mock_secrets_client = Mock()
        mock_secrets_client.get_secret_value.return_value = {"SecretString": json.dumps(secret_data)}
        mock_boto_client.return_value = mock_secrets_client

        key_manager = VersionedKeyManager("arn:aws:secretsmanager:us-east-1:123456789012:secret:test")
        token_encryption = VersionedTokenEncryption(key_manager)

        # Encrypt with current key (v2)
        token = "test-token"
        encrypted_v2 = token_encryption.encrypt_token(token)
        assert encrypted_v2.startswith("v2:")

        # Manually create a token encrypted with v1
        from ml_space_lambda.auth.session.encryption import TokenEncryption

        encryptor_v1 = TokenEncryption(key1)
        encrypted_v1_data = encryptor_v1.encrypt_token(token)
        encrypted_v1 = f"v1:{encrypted_v1_data}"

        # Should be able to decrypt both versions
        assert token_encryption.decrypt_token(encrypted_v1) == token
        assert token_encryption.decrypt_token(encrypted_v2) == token

    @patch("boto3.client")
    def test_decrypt_invalid_format(self, mock_boto_client):
        """Test decrypting token with invalid format."""
        key1 = create_encryption_key()

        secret_data = {"current_version": 1, "keys": {"1": encode_key_for_storage(key1)}}

        mock_secrets_client = Mock()
        mock_secrets_client.get_secret_value.return_value = {"SecretString": json.dumps(secret_data)}
        mock_boto_client.return_value = mock_secrets_client

        key_manager = VersionedKeyManager("arn:aws:secretsmanager:us-east-1:123456789012:secret:test")
        token_encryption = VersionedTokenEncryption(key_manager)

        # Invalid formats
        with pytest.raises(Exception, match="Invalid versioned token format"):
            token_encryption.decrypt_token("no-version-prefix")

        with pytest.raises(Exception, match="Invalid versioned token format"):
            token_encryption.decrypt_token("v1-no-colon")

    @patch("boto3.client")
    def test_decrypt_missing_key_version(self, mock_boto_client):
        """Test decrypting token with unavailable key version."""
        key1 = create_encryption_key()

        secret_data = {"current_version": 1, "keys": {"1": encode_key_for_storage(key1)}}

        mock_secrets_client = Mock()
        mock_secrets_client.get_secret_value.return_value = {"SecretString": json.dumps(secret_data)}
        mock_boto_client.return_value = mock_secrets_client

        key_manager = VersionedKeyManager("arn:aws:secretsmanager:us-east-1:123456789012:secret:test")
        token_encryption = VersionedTokenEncryption(key_manager)

        # Try to decrypt with non-existent version
        with pytest.raises(Exception, match="Key version 99 not available"):
            token_encryption.decrypt_token("v99:some-encrypted-data")

    @patch("boto3.client")
    def test_is_encrypted_token(self, mock_boto_client):
        """Test checking if token is encrypted."""
        key1 = create_encryption_key()

        secret_data = {"current_version": 1, "keys": {"1": encode_key_for_storage(key1)}}

        mock_secrets_client = Mock()
        mock_secrets_client.get_secret_value.return_value = {"SecretString": json.dumps(secret_data)}
        mock_boto_client.return_value = mock_secrets_client

        key_manager = VersionedKeyManager("arn:aws:secretsmanager:us-east-1:123456789012:secret:test")
        token_encryption = VersionedTokenEncryption(key_manager)

        # Encrypted tokens
        assert token_encryption.is_encrypted_token("v1:encrypted-data")
        assert token_encryption.is_encrypted_token("v2:other-data")

        # Not encrypted
        assert not token_encryption.is_encrypted_token("plain-token")
        assert not token_encryption.is_encrypted_token("")
        assert not token_encryption.is_encrypted_token("v1-no-colon")

    @patch("boto3.client")
    def test_encryptor_caching(self, mock_boto_client):
        """Test that encryptors are cached for performance."""
        key1 = create_encryption_key()

        secret_data = {"current_version": 1, "keys": {"1": encode_key_for_storage(key1)}}

        mock_secrets_client = Mock()
        mock_secrets_client.get_secret_value.return_value = {"SecretString": json.dumps(secret_data)}
        mock_boto_client.return_value = mock_secrets_client

        key_manager = VersionedKeyManager("arn:aws:secretsmanager:us-east-1:123456789012:secret:test")
        token_encryption = VersionedTokenEncryption(key_manager)

        # Encrypt and decrypt multiple times
        token = "test-token"
        encrypted = token_encryption.encrypt_token(token)

        # First decrypt should create encryptor
        token_encryption.decrypt_token(encrypted)
        assert 1 in token_encryption._encryptors_cache

        # Second decrypt should use cached encryptor
        token_encryption.decrypt_token(encrypted)
        assert len(token_encryption._encryptors_cache) == 1


class TestVersionedStateManager:
    """Tests for VersionedStateManager class."""

    @patch("boto3.client")
    def test_create_and_validate_state(self, mock_boto_client):
        """Test creating and validating state parameters."""
        # Create a Fernet key for state encryption
        state_key = Fernet.generate_key()

        # Fernet keys are already base64-encoded, store them directly
        secret_data = {"current_version": 1, "keys": {"1": state_key.decode("utf-8")}}

        mock_secrets_client = Mock()
        mock_secrets_client.get_secret_value.return_value = {"SecretString": json.dumps(secret_data)}
        mock_boto_client.return_value = mock_secrets_client

        key_manager = VersionedKeyManager("arn:aws:secretsmanager:us-east-1:123456789012:secret:test", key_type="state")
        state_manager = VersionedStateManager(key_manager)

        # Create state
        redirect_url = "https://example.com/callback"
        domain = "example.com"
        nonce = "test-nonce-12345"

        state = state_manager.create_state(redirect_url, domain, nonce)

        # Verify format
        assert state.startswith("v1:")

        # Validate state
        validated = state_manager.validate_state(state, nonce, max_age_seconds=600)
        assert validated is not None
        assert validated["redirect_url"] == redirect_url
        assert validated["domain"] == domain
        assert validated["nonce"] == nonce
        assert "timestamp" in validated

    @patch("boto3.client")
    def test_validate_state_with_old_version(self, mock_boto_client):
        """Test validating state encrypted with older key version."""
        state_key1 = Fernet.generate_key()
        state_key2 = Fernet.generate_key()

        secret_data = {
            "current_version": 2,
            "keys": {"1": state_key1.decode("utf-8"), "2": state_key2.decode("utf-8")},
        }

        mock_secrets_client = Mock()
        mock_secrets_client.get_secret_value.return_value = {"SecretString": json.dumps(secret_data)}
        mock_boto_client.return_value = mock_secrets_client

        key_manager = VersionedKeyManager("arn:aws:secretsmanager:us-east-1:123456789012:secret:test", key_type="state")
        state_manager = VersionedStateManager(key_manager)

        # Create state with current key (v2)
        nonce = "test-nonce"
        state_v2 = state_manager.create_state("https://example.com", "example.com", nonce)
        assert state_v2.startswith("v2:")

        # Manually create state with v1
        import time

        cipher_v1 = Fernet(state_key1)
        state_data = {
            "redirect_url": "https://example.com",
            "nonce": nonce,
            "timestamp": int(time.time()),
            "domain": "example.com",
        }
        encrypted_v1 = cipher_v1.encrypt(json.dumps(state_data, separators=(",", ":")).encode("utf-8"))
        state_v1 = f"v1:{encrypted_v1.decode('utf-8')}"

        # Should validate both versions
        assert state_manager.validate_state(state_v1, nonce) is not None
        assert state_manager.validate_state(state_v2, nonce) is not None

    @patch("boto3.client")
    def test_validate_state_expired(self, mock_boto_client):
        """Test validating expired state."""
        state_key = Fernet.generate_key()

        secret_data = {"current_version": 1, "keys": {"1": state_key.decode("utf-8")}}

        mock_secrets_client = Mock()
        mock_secrets_client.get_secret_value.return_value = {"SecretString": json.dumps(secret_data)}
        mock_boto_client.return_value = mock_secrets_client

        key_manager = VersionedKeyManager("arn:aws:secretsmanager:us-east-1:123456789012:secret:test", key_type="state")
        state_manager = VersionedStateManager(key_manager)

        # Create state with old timestamp
        import time

        cipher = Fernet(state_key)
        nonce = "test-nonce"
        old_timestamp = int(time.time()) - 700  # 700 seconds ago
        state_data = {
            "redirect_url": "https://example.com",
            "nonce": nonce,
            "timestamp": old_timestamp,
            "domain": "example.com",
        }
        encrypted = cipher.encrypt(json.dumps(state_data, separators=(",", ":")).encode("utf-8"))
        expired_state = f"v1:{encrypted.decode('utf-8')}"

        # Should fail validation due to age
        result = state_manager.validate_state(expired_state, nonce, max_age_seconds=600)
        assert result is None

    @patch("boto3.client")
    def test_validate_state_wrong_nonce(self, mock_boto_client):
        """Test validating state with wrong nonce."""
        state_key = Fernet.generate_key()

        secret_data = {"current_version": 1, "keys": {"1": state_key.decode("utf-8")}}

        mock_secrets_client = Mock()
        mock_secrets_client.get_secret_value.return_value = {"SecretString": json.dumps(secret_data)}
        mock_boto_client.return_value = mock_secrets_client

        key_manager = VersionedKeyManager("arn:aws:secretsmanager:us-east-1:123456789012:secret:test", key_type="state")
        state_manager = VersionedStateManager(key_manager)

        # Create state
        state = state_manager.create_state("https://example.com", "example.com", "correct-nonce")

        # Try to validate with wrong nonce
        result = state_manager.validate_state(state, "wrong-nonce")
        assert result is None

    @patch("boto3.client")
    def test_validate_state_invalid_format(self, mock_boto_client):
        """Test validating state with invalid format."""
        state_key = Fernet.generate_key()

        secret_data = {"current_version": 1, "keys": {"1": state_key.decode("utf-8")}}

        mock_secrets_client = Mock()
        mock_secrets_client.get_secret_value.return_value = {"SecretString": json.dumps(secret_data)}
        mock_boto_client.return_value = mock_secrets_client

        key_manager = VersionedKeyManager("arn:aws:secretsmanager:us-east-1:123456789012:secret:test", key_type="state")
        state_manager = VersionedStateManager(key_manager)

        # Invalid formats
        assert state_manager.validate_state("", "nonce") is None
        assert state_manager.validate_state("no-version", "nonce") is None
        assert state_manager.validate_state("v1-no-colon", "nonce") is None
        assert state_manager.validate_state("v1:data", "") is None

    @patch("boto3.client")
    def test_validate_state_missing_fields(self, mock_boto_client):
        """Test validating state with missing required fields."""
        state_key = Fernet.generate_key()

        secret_data = {"current_version": 1, "keys": {"1": state_key.decode("utf-8")}}

        mock_secrets_client = Mock()
        mock_secrets_client.get_secret_value.return_value = {"SecretString": json.dumps(secret_data)}
        mock_boto_client.return_value = mock_secrets_client

        key_manager = VersionedKeyManager("arn:aws:secretsmanager:us-east-1:123456789012:secret:test", key_type="state")
        state_manager = VersionedStateManager(key_manager)

        # Create state with missing fields

        cipher = Fernet(state_key)
        incomplete_data = {"redirect_url": "https://example.com"}  # Missing nonce, timestamp, domain
        encrypted = cipher.encrypt(json.dumps(incomplete_data).encode("utf-8"))
        invalid_state = f"v1:{encrypted.decode('utf-8')}"

        result = state_manager.validate_state(invalid_state, "nonce")
        assert result is None

    @patch("boto3.client")
    def test_cipher_caching(self, mock_boto_client):
        """Test that ciphers are cached for performance."""
        state_key = Fernet.generate_key()

        secret_data = {"current_version": 1, "keys": {"1": state_key.decode("utf-8")}}

        mock_secrets_client = Mock()
        mock_secrets_client.get_secret_value.return_value = {"SecretString": json.dumps(secret_data)}
        mock_boto_client.return_value = mock_secrets_client

        key_manager = VersionedKeyManager("arn:aws:secretsmanager:us-east-1:123456789012:secret:test", key_type="state")
        state_manager = VersionedStateManager(key_manager)

        # Create and validate state multiple times
        nonce = "test-nonce"
        state = state_manager.create_state("https://example.com", "example.com", nonce)

        # First validation should create cipher
        state_manager.validate_state(state, nonce)
        assert 1 in state_manager._ciphers_cache

        # Second validation should use cached cipher
        state_manager.validate_state(state, nonce)
        assert len(state_manager._ciphers_cache) == 1
