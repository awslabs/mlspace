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
Key management utilities for encryption key rotation support.

Provides versioned key management to enable graceful key rotation
without invalidating existing sessions or authentication flows.
"""

import json
import logging
from typing import Dict, Optional, Tuple

import boto3
from cryptography.fernet import Fernet

from ml_space_lambda.auth.session.encryption import TokenEncryption, decode_key_from_storage

logger = logging.getLogger(__name__)


class VersionedKeyManager:
    """
    Manages versioned encryption keys for graceful rotation.

    Supports multiple key versions to allow decryption of data encrypted
    with previous keys while using the latest key for new encryption.
    """

    def __init__(self, secret_arn: str, key_type: str = "token"):
        """
        Initialize versioned key manager.

        Args:
            secret_arn: AWS Secrets Manager ARN containing versioned keys
            key_type: Type of key ("token" or "state")
        """
        self.secret_arn = secret_arn
        self.key_type = key_type
        self.secrets_client = boto3.client("secretsmanager")
        self._keys_cache: Optional[Dict] = None

    def _load_keys(self) -> Dict:
        """
        Load all key versions from Secrets Manager.

        Returns:
            Dictionary with key versions and metadata
        """
        if self._keys_cache is not None:
            return self._keys_cache

        try:
            response = self.secrets_client.get_secret_value(SecretId=self.secret_arn)
            secret_data = json.loads(response["SecretString"])

            # Expected format:
            # {
            #   "current_version": 2,
            #   "keys": {
            #     "1": "base64-encoded-key-v1",
            #     "2": "base64-encoded-key-v2"
            #   },
            #   "rotation_date": "2024-01-15T10:30:00Z"
            # }

            self._keys_cache = secret_data
            return secret_data

        except Exception as e:
            logger.error(f"Failed to load keys from {self.secret_arn}: {e}")
            raise Exception(f"Key loading failed: {e}")

    def get_current_key(self) -> Tuple[int, bytes]:
        """
        Get the current (latest) encryption key.

        Returns:
            Tuple of (version, key_bytes)
        """
        keys_data = self._load_keys()
        current_version = keys_data["current_version"]

        if str(current_version) not in keys_data["keys"]:
            raise Exception(f"Current key version {current_version} not found")

        encoded_key = keys_data["keys"][str(current_version)]

        if self.key_type == "token":
            key_bytes = decode_key_from_storage(encoded_key)
        else:  # state key (Fernet key is already base64 encoded)
            from ml_space_lambda.auth.utils.state import decode_state_key_from_storage

            key_bytes = decode_state_key_from_storage(encoded_key)

        return current_version, key_bytes

    def get_key_by_version(self, version: int) -> Optional[bytes]:
        """
        Get a specific key version.

        Args:
            version: Key version number

        Returns:
            Key bytes if found, None otherwise
        """
        try:
            keys_data = self._load_keys()

            if str(version) not in keys_data["keys"]:
                return None

            encoded_key = keys_data["keys"][str(version)]

            if self.key_type == "token":
                return decode_key_from_storage(encoded_key)
            else:  # state key
                from ml_space_lambda.auth.utils.state import decode_state_key_from_storage

                return decode_state_key_from_storage(encoded_key)

        except Exception:
            return None

    def get_all_keys(self) -> Dict[int, bytes]:
        """
        Get all available key versions.

        Returns:
            Dictionary mapping version numbers to key bytes
        """
        keys_data = self._load_keys()
        result = {}

        for version_str, encoded_key in keys_data["keys"].items():
            try:
                version = int(version_str)
                if self.key_type == "token":
                    key_bytes = decode_key_from_storage(encoded_key)
                else:  # state key
                    from ml_space_lambda.auth.utils.state import decode_state_key_from_storage

                    key_bytes = decode_state_key_from_storage(encoded_key)
                result[version] = key_bytes
            except Exception:
                logger.warning(f"Failed to decode key version {version_str}")
                continue

        return result

    def invalidate_cache(self):
        """Invalidate the keys cache to force reload on next access."""
        self._keys_cache = None


class VersionedTokenEncryption:
    """
    Token encryption with support for multiple key versions.

    Always encrypts with the current key but can decrypt with any available key version.
    """

    def __init__(self, key_manager: VersionedKeyManager):
        """
        Initialize versioned token encryption.

        Args:
            key_manager: Versioned key manager instance
        """
        self.key_manager = key_manager
        self._encryptors_cache: Dict[int, TokenEncryption] = {}

    def _get_encryptor(self, version: int) -> Optional[TokenEncryption]:
        """
        Get token encryptor for specific key version.

        Args:
            version: Key version

        Returns:
            TokenEncryption instance or None if key not found
        """
        if version in self._encryptors_cache:
            return self._encryptors_cache[version]

        key_bytes = self.key_manager.get_key_by_version(version)
        if key_bytes is None:
            return None

        try:
            encryptor = TokenEncryption(key_bytes)
            self._encryptors_cache[version] = encryptor
            return encryptor
        except Exception:
            return None

    def encrypt_token(self, token: str) -> str:
        """
        Encrypt token with current key version.

        Args:
            token: Plain text token

        Returns:
            Versioned encrypted token: v{version}:{encrypted_token}
        """
        current_version, current_key = self.key_manager.get_current_key()
        encryptor = TokenEncryption(current_key)

        encrypted = encryptor.encrypt_token(token)
        return f"v{current_version}:{encrypted}"

    def decrypt_token(self, versioned_token: str) -> str:
        """
        Decrypt token using appropriate key version.

        Args:
            versioned_token: Token in format v{version}:{encrypted_token}

        Returns:
            Decrypted token

        Raises:
            Exception: If decryption fails or key version not found
        """
        # Parse versioned token
        try:
            version_part, encrypted_part = versioned_token.split(":", 1)
            version = int(version_part[1:])  # Remove 'v' prefix
        except (ValueError, IndexError):
            raise Exception("Invalid versioned token format")

        # Get encryptor for this version
        encryptor = self._get_encryptor(version)
        if encryptor is None:
            raise Exception(f"Key version {version} not available")

        return encryptor.decrypt_token(encrypted_part)

    def is_encrypted_token(self, token: str) -> bool:
        """
        Check if token is encrypted (versioned format).

        Args:
            token: Token string to check

        Returns:
            True if token appears to be encrypted
        """
        if not token:
            return False

        # Check for versioned format: v{number}:{encrypted_data}
        return token.startswith("v") and ":" in token


class VersionedStateManager:
    """
    State parameter encryption with support for multiple key versions.
    """

    def __init__(self, key_manager: VersionedKeyManager):
        """
        Initialize versioned state manager.

        Args:
            key_manager: Versioned key manager instance
        """
        self.key_manager = key_manager
        self._ciphers_cache: Dict[int, Fernet] = {}

    def _get_cipher(self, version: int) -> Optional[Fernet]:
        """
        Get Fernet cipher for specific key version.

        Args:
            version: Key version

        Returns:
            Fernet instance or None if key not found
        """
        if version in self._ciphers_cache:
            return self._ciphers_cache[version]

        key_bytes = self.key_manager.get_key_by_version(version)
        if key_bytes is None:
            return None

        try:
            cipher = Fernet(key_bytes)
            self._ciphers_cache[version] = cipher
            return cipher
        except Exception:
            return None

    def create_state(self, redirect_url: str, domain: str, nonce: Optional[str] = None) -> str:
        """
        Create versioned encrypted state parameter.

        Args:
            redirect_url: Where to redirect after authentication
            domain: Domain initiating authentication
            nonce: Optional nonce

        Returns:
            Versioned encrypted state: v{version}:{encrypted_state}
        """
        import json
        import secrets
        import time

        if nonce is None:
            nonce = secrets.token_urlsafe(32)

        state_data = {"redirect_url": redirect_url, "nonce": nonce, "timestamp": int(time.time()), "domain": domain}

        current_version, current_key = self.key_manager.get_current_key()
        cipher = Fernet(current_key)

        state_json = json.dumps(state_data, separators=(",", ":"))
        encrypted = cipher.encrypt(state_json.encode("utf-8"))

        return f"v{current_version}:{encrypted.decode('utf-8')}"

    def validate_state(self, versioned_state: str, cookie_nonce: str, max_age_seconds: int = 600) -> Optional[Dict]:
        """
        Validate versioned encrypted state parameter.

        Args:
            versioned_state: State in format v{version}:{encrypted_state}
            cookie_nonce: Nonce from state cookie
            max_age_seconds: Maximum age of state parameter

        Returns:
            State data if valid, None otherwise
        """
        if not versioned_state or not cookie_nonce:
            return None

        # Parse versioned state
        try:
            version_part, encrypted_part = versioned_state.split(":", 1)
            version = int(version_part[1:])  # Remove 'v' prefix
        except (ValueError, IndexError):
            return None

        # Get cipher for this version
        cipher = self._get_cipher(version)
        if cipher is None:
            return None

        return self._validate_with_cipher(cipher, encrypted_part, cookie_nonce, max_age_seconds)

    def _validate_with_cipher(
        self, cipher: Fernet, encrypted_state: str, cookie_nonce: str, max_age_seconds: int
    ) -> Optional[Dict]:
        """
        Validate state with specific cipher.

        Args:
            cipher: Fernet cipher instance
            encrypted_state: Encrypted state data
            cookie_nonce: Nonce from cookie
            max_age_seconds: Maximum age

        Returns:
            State data if valid, None otherwise
        """
        import json
        import time

        try:
            decrypted = cipher.decrypt(encrypted_state.encode("utf-8"))
            state_data = json.loads(decrypted.decode("utf-8"))

            # Validate required fields
            required_fields = ["redirect_url", "nonce", "timestamp", "domain"]
            if not all(field in state_data for field in required_fields):
                return None

            # Validate timestamp
            state_age = int(time.time()) - state_data["timestamp"]
            if state_age > max_age_seconds:
                return None

            # Validate nonce
            if state_data["nonce"] != cookie_nonce:
                return None

            return state_data

        except Exception:
            return None
