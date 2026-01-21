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
Tests for state parameter management.
"""

import json
import time

import pytest
from cryptography.fernet import Fernet

from ml_space_lambda.auth.utils.state import (
    StateManager,
    create_state_encryption_key,
    decode_state_key_from_storage,
    encode_state_key_for_storage,
)


class TestStateManager:
    """Tests for StateManager class."""

    def test_create_state_with_nonce(self):
        """Test creating state with provided nonce."""
        key = Fernet.generate_key()
        manager = StateManager(key)

        state = manager.create_state(redirect_url="https://example.com/callback", domain="example.com", nonce="test-nonce-123")

        assert state is not None
        assert isinstance(state, str)
        assert len(state) > 0

    def test_create_state_without_nonce(self):
        """Test creating state with auto-generated nonce."""
        key = Fernet.generate_key()
        manager = StateManager(key)

        state = manager.create_state(redirect_url="https://example.com/callback", domain="example.com")

        assert state is not None
        assert isinstance(state, str)

    def test_create_state_with_protocol_data(self):
        """Test creating state with protocol-specific data."""
        key = Fernet.generate_key()
        manager = StateManager(key)

        protocol_data = {"code_verifier": "test-verifier-123", "custom_field": "value"}

        state = manager.create_state(
            redirect_url="https://example.com/callback", domain="example.com", nonce="test-nonce", protocol_data=protocol_data
        )

        assert state is not None

        # Validate we can decrypt and retrieve protocol data
        validated = manager.validate_state(state, "test-nonce")
        assert validated is not None
        assert validated["protocol_data"] == protocol_data

    def test_validate_state_success(self):
        """Test successful state validation."""
        key = Fernet.generate_key()
        manager = StateManager(key)

        nonce = "test-nonce-123"
        state = manager.create_state(redirect_url="https://example.com/callback", domain="example.com", nonce=nonce)

        validated = manager.validate_state(state, nonce)

        assert validated is not None
        assert validated["redirect_url"] == "https://example.com/callback"
        assert validated["domain"] == "example.com"
        assert validated["nonce"] == nonce
        assert "timestamp" in validated

    def test_validate_state_with_protocol_data(self):
        """Test state validation with protocol data."""
        key = Fernet.generate_key()
        manager = StateManager(key)

        nonce = "test-nonce"
        protocol_data = {"code_verifier": "verifier-123"}

        state = manager.create_state(
            redirect_url="https://example.com/callback", domain="example.com", nonce=nonce, protocol_data=protocol_data
        )

        validated = manager.validate_state(state, nonce)

        assert validated is not None
        assert validated["protocol_data"]["code_verifier"] == "verifier-123"

    def test_validate_state_empty_state(self):
        """Test validation with empty state."""
        key = Fernet.generate_key()
        manager = StateManager(key)

        validated = manager.validate_state("", "nonce")
        assert validated is None

    def test_validate_state_empty_nonce(self):
        """Test validation with empty nonce."""
        key = Fernet.generate_key()
        manager = StateManager(key)

        state = manager.create_state(redirect_url="https://example.com/callback", domain="example.com", nonce="test-nonce")

        validated = manager.validate_state(state, "")
        assert validated is None

    def test_validate_state_nonce_mismatch(self):
        """Test validation with mismatched nonce."""
        key = Fernet.generate_key()
        manager = StateManager(key)

        state = manager.create_state(redirect_url="https://example.com/callback", domain="example.com", nonce="correct-nonce")

        validated = manager.validate_state(state, "wrong-nonce")
        assert validated is None

    def test_validate_state_expired(self):
        """Test validation with expired state."""
        key = Fernet.generate_key()
        manager = StateManager(key)

        nonce = "test-nonce"

        # Create state with old timestamp by manually crafting it
        old_timestamp = int(time.time()) - 700  # 700 seconds ago
        state_data = {
            "redirect_url": "https://example.com/callback",
            "nonce": nonce,
            "timestamp": old_timestamp,
            "domain": "example.com",
        }

        state_json = json.dumps(state_data, separators=(",", ":"))
        encrypted = manager.cipher.encrypt(state_json.encode("utf-8"))
        state = encrypted.decode("utf-8")

        # Validate with max_age of 600 seconds (10 minutes)
        validated = manager.validate_state(state, nonce, max_age_seconds=600)

        assert validated is None

    def test_validate_state_invalid_encrypted_data(self):
        """Test validation with invalid encrypted data."""
        key = Fernet.generate_key()
        manager = StateManager(key)

        validated = manager.validate_state("invalid-encrypted-data", "nonce")
        assert validated is None

    def test_validate_state_tampered_data(self):
        """Test validation with tampered state."""
        key = Fernet.generate_key()
        manager = StateManager(key)

        nonce = "test-nonce"
        state = manager.create_state(redirect_url="https://example.com/callback", domain="example.com", nonce=nonce)

        # Tamper with the state
        tampered_state = state[:-5] + "XXXXX"

        validated = manager.validate_state(tampered_state, nonce)
        assert validated is None

    def test_validate_state_different_key(self):
        """Test validation with different encryption key."""
        key1 = Fernet.generate_key()
        key2 = Fernet.generate_key()

        manager1 = StateManager(key1)
        manager2 = StateManager(key2)

        nonce = "test-nonce"
        state = manager1.create_state(redirect_url="https://example.com/callback", domain="example.com", nonce=nonce)

        # Try to validate with different key
        validated = manager2.validate_state(state, nonce)
        assert validated is None

    def test_validate_state_missing_required_fields(self):
        """Test validation with state missing required fields."""
        key = Fernet.generate_key()
        manager = StateManager(key)

        # Create state with missing fields by manually encrypting
        incomplete_data = {"redirect_url": "https://example.com/callback"}  # Missing nonce, timestamp, domain
        state_json = json.dumps(incomplete_data)
        encrypted = manager.cipher.encrypt(state_json.encode("utf-8"))
        state = encrypted.decode("utf-8")

        validated = manager.validate_state(state, "nonce")
        assert validated is None

    def test_generate_nonce(self):
        """Test nonce generation."""
        key = Fernet.generate_key()
        manager = StateManager(key)

        nonce1 = manager.generate_nonce()
        nonce2 = manager.generate_nonce()

        assert nonce1 is not None
        assert nonce2 is not None
        assert nonce1 != nonce2  # Should be unique
        assert len(nonce1) > 20  # Should be reasonably long

    def test_create_state_encryption_key(self):
        """Test encryption key generation."""
        key = create_state_encryption_key()

        assert key is not None
        assert isinstance(key, bytes)
        # Fernet keys are 44 bytes when base64 encoded
        assert len(key) == 44

        # Should be able to create a Fernet instance with it
        cipher = Fernet(key)
        assert cipher is not None

    def test_encode_decode_state_key(self):
        """Test encoding and decoding state key for storage."""
        key = create_state_encryption_key()

        # Encode for storage
        encoded = encode_state_key_for_storage(key)
        assert isinstance(encoded, str)

        # Decode from storage
        decoded = decode_state_key_from_storage(encoded)
        assert decoded == key

        # Should be able to use decoded key
        manager = StateManager(decoded)
        state = manager.create_state(redirect_url="https://example.com", domain="example.com", nonce="test")
        assert state is not None

    def test_decode_invalid_state_key(self):
        """Test decoding invalid state key."""
        with pytest.raises(ValueError, match="Invalid Fernet key"):
            decode_state_key_from_storage("invalid-key-data")

    def test_decode_empty_state_key(self):
        """Test decoding empty state key."""
        with pytest.raises(ValueError, match="Invalid Fernet key"):
            decode_state_key_from_storage("")

    def test_create_state_exception_handling(self):
        """Test state creation with invalid data that causes exception."""
        key = Fernet.generate_key()
        manager = StateManager(key)

        # Create a scenario that would cause JSON serialization to fail
        # by mocking the cipher to raise an exception
        original_encrypt = manager.cipher.encrypt

        def mock_encrypt(data):
            raise Exception("Encryption failed")

        manager.cipher.encrypt = mock_encrypt

        with pytest.raises(Exception, match="Failed to create state parameter"):
            manager.create_state(redirect_url="https://example.com", domain="example.com")

        # Restore original
        manager.cipher.encrypt = original_encrypt

    def test_state_roundtrip_with_special_characters(self):
        """Test state creation and validation with special characters in URLs."""
        key = Fernet.generate_key()
        manager = StateManager(key)

        nonce = "test-nonce"
        redirect_url = "https://example.com/callback?param=value&other=test#fragment"

        state = manager.create_state(redirect_url=redirect_url, domain="example.com", nonce=nonce)

        validated = manager.validate_state(state, nonce)

        assert validated is not None
        assert validated["redirect_url"] == redirect_url

    def test_state_max_age_boundary(self):
        """Test state validation at max age boundary."""
        key = Fernet.generate_key()
        manager = StateManager(key)

        nonce = "test-nonce"
        state = manager.create_state(redirect_url="https://example.com/callback", domain="example.com", nonce=nonce)

        # Should be valid with large max_age
        validated = manager.validate_state(state, nonce, max_age_seconds=3600)
        assert validated is not None

        # Should be valid with exact age (within 1 second)
        validated = manager.validate_state(state, nonce, max_age_seconds=1)
        assert validated is not None
