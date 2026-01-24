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

import pytest

from ml_space_lambda.auth.session.encryption import (
    TokenEncryption,
    create_encryption_key,
    decode_key_from_storage,
    encode_key_for_storage,
)


class TestTokenEncryption:
    """Test token encryption functionality."""

    def test_encrypt_decrypt_token(self):
        """Test basic encryption and decryption."""
        key = create_encryption_key()
        encryption = TokenEncryption(key)

        original_token = "test_access_token_12345"
        encrypted = encryption.encrypt_token(original_token)
        decrypted = encryption.decrypt_token(encrypted)

        assert decrypted == original_token
        assert encrypted != original_token
        assert encrypted.startswith("v4.local.")

    def test_encrypt_token_format(self):
        """Test encrypted token format."""
        key = create_encryption_key()
        encryption = TokenEncryption(key)

        token = "test_token"
        encrypted = encryption.encrypt_token(token)

        # PASETO v4.local tokens start with "v4.local."
        assert encrypted.startswith("v4.local.")

    def test_encrypt_empty_token_raises_error(self):
        """Test that encrypting empty token raises error."""
        key = create_encryption_key()
        encryption = TokenEncryption(key)

        with pytest.raises(ValueError, match="Token cannot be empty"):
            encryption.encrypt_token("")

    def test_decrypt_invalid_format_raises_error(self):
        """Test that decrypting invalid format raises error."""
        key = create_encryption_key()
        encryption = TokenEncryption(key)

        with pytest.raises(Exception, match="Token decryption failed"):
            encryption.decrypt_token("invalid_format")

    def test_decrypt_with_wrong_key_raises_error(self):
        """Test that decrypting with wrong key raises error."""
        key1 = create_encryption_key()
        key2 = create_encryption_key()

        encryption1 = TokenEncryption(key1)
        encryption2 = TokenEncryption(key2)

        token = "test_token"
        encrypted = encryption1.encrypt_token(token)

        with pytest.raises(Exception, match="Token decryption failed"):
            encryption2.decrypt_token(encrypted)

    def test_is_encrypted_token(self):
        """Test checking if token is encrypted."""
        key = create_encryption_key()
        encryption = TokenEncryption(key)

        plain_token = "plain_token"
        encrypted_token = encryption.encrypt_token(plain_token)

        assert encryption.is_encrypted_token(encrypted_token)
        assert not encryption.is_encrypted_token(plain_token)
        assert not encryption.is_encrypted_token("")

    def test_invalid_key_length_raises_error(self):
        """Test that invalid key length raises error."""
        with pytest.raises(ValueError, match="Encryption key must be exactly 32 bytes"):
            TokenEncryption(b"short_key")

    def test_encode_decode_key(self):
        """Test encoding and decoding encryption key."""
        key = create_encryption_key()
        encoded = encode_key_for_storage(key)
        decoded = decode_key_from_storage(encoded)

        assert decoded == key
        assert len(decoded) == 32

    def test_decode_invalid_key_raises_error(self):
        """Test that decoding invalid key raises error."""
        with pytest.raises(ValueError, match="Invalid encoded key"):
            decode_key_from_storage("not_valid_base64!!!")
