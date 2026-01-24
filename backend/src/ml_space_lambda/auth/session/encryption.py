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
Token encryption utilities using PASETO for secure storage of IdP tokens.

PASETO (Platform-Agnostic Security Tokens) provides authenticated encryption
with a simple, secure API that's specifically designed for token handling.
"""

import base64

import pyseto
from pyseto import Key


class TokenEncryption:
    """
    Handles encryption and decryption of sensitive tokens using PASETO.

    PASETO provides authenticated encryption specifically designed for tokens,
    with built-in versioning and no algorithm confusion vulnerabilities.
    """

    def __init__(self, encryption_key: bytes):
        """
        Initialize token encryption with PASETO.

        Args:
            encryption_key: 32-byte encryption key from AWS Secrets Manager
        """
        if len(encryption_key) != 32:
            raise ValueError("Encryption key must be exactly 32 bytes")

        self.key = Key.new(version=4, purpose="local", key=encryption_key)

    def encrypt_token(self, token: str) -> str:
        """
        Encrypt token using PASETO v4.local.

        Args:
            token: Plain text token to encrypt

        Returns:
            Encrypted PASETO token string

        Raises:
            ValueError: If token is empty or None
        """
        if not token:
            raise ValueError("Token cannot be empty or None")

        try:
            # PASETO handles all the crypto details (nonce, authentication, etc.)
            encrypted = pyseto.encode(self.key, token.encode("utf-8"))
            return encrypted.decode("utf-8")
        except Exception as e:
            raise Exception(f"Token encryption failed: {e}")

    def decrypt_token(self, encrypted_token: str) -> str:
        """
        Decrypt PASETO token.

        Args:
            encrypted_token: PASETO token string

        Returns:
            Decrypted token as plain text

        Raises:
            ValueError: If encrypted token format is invalid
            Exception: If decryption fails (invalid key, corrupted data, etc.)
        """
        if not encrypted_token:
            raise ValueError("Encrypted token cannot be empty or None")

        try:
            # PASETO handles verification and decryption
            decrypted = pyseto.decode(self.key, encrypted_token.encode("utf-8"))
            return decrypted.payload.decode("utf-8")
        except Exception as e:
            raise Exception(f"Token decryption failed: {e}")

    def is_encrypted_token(self, token: str) -> bool:
        """
        Check if a token string is in PASETO format.

        Args:
            token: Token string to check

        Returns:
            True if token appears to be a PASETO token, False otherwise
        """
        if not token:
            return False

        # PASETO v4.local tokens start with "v4.local."
        return token.startswith("v4.local.")


def create_encryption_key() -> bytes:
    """
    Generate a new 32-byte encryption key for PASETO.

    Returns:
        32-byte cryptographically secure random key
    """
    import os

    # Generate 32 random bytes for PASETO v4.local
    return os.urandom(32)


def encode_key_for_storage(key: bytes) -> str:
    """
    Encode encryption key as base64 for storage in AWS Secrets Manager.

    Args:
        key: 32-byte encryption key

    Returns:
        Base64 encoded key string
    """
    return base64.b64encode(key).decode("utf-8")


def decode_key_from_storage(encoded_key: str) -> bytes:
    """
    Decode base64 encoded key from AWS Secrets Manager.

    Args:
        encoded_key: Base64 encoded key string

    Returns:
        32-byte encryption key

    Raises:
        ValueError: If key is not valid base64 or not 32 bytes
    """
    try:
        key = base64.b64decode(encoded_key)
        if len(key) != 32:
            raise ValueError(f"Decoded key must be 32 bytes, got {len(key)}")
        return key
    except Exception as e:
        raise ValueError(f"Invalid encoded key: {e}")
