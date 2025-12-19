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
State parameter management for CSRF protection in authentication flows.

Handles creation and validation of encrypted state parameters used during
OIDC authentication to prevent CSRF attacks.
"""

import json
import secrets
import time
from typing import Dict, Optional

from cryptography.fernet import Fernet


class StateManager:
    """
    Manages encrypted state parameters for CSRF protection during authentication.

    Uses Fernet symmetric encryption to create tamper-proof state parameters
    that include nonce, timestamp, and redirect information.
    """

    def __init__(self, secret_key: bytes):
        """
        Initialize state manager with encryption key.

        Args:
            secret_key: 32-byte key for Fernet encryption
        """
        self.cipher = Fernet(secret_key)

    def create_state(self, redirect_url: str, domain: str, nonce: Optional[str] = None) -> str:
        """
        Create encrypted state parameter for auth flow.

        Args:
            redirect_url: Where to redirect after authentication
            domain: Domain initiating the authentication
            nonce: Optional nonce (generated if not provided)

        Returns:
            Encrypted state string

        Raises:
            Exception: If state creation fails
        """
        if nonce is None:
            nonce = secrets.token_urlsafe(32)

        state_data = {"redirect_url": redirect_url, "nonce": nonce, "timestamp": int(time.time()), "domain": domain}

        try:
            state_json = json.dumps(state_data, separators=(",", ":"))
            encrypted = self.cipher.encrypt(state_json.encode("utf-8"))
            return encrypted.decode("utf-8")
        except Exception as e:
            raise Exception(f"Failed to create state parameter: {e}")

    def validate_state(self, encrypted_state: str, cookie_nonce: str, max_age_seconds: int = 600) -> Optional[Dict]:
        """
        Validate and decrypt state parameter.

        Args:
            encrypted_state: State from query parameter
            cookie_nonce: Nonce from state cookie
            max_age_seconds: Maximum age of state parameter (default 10 minutes)

        Returns:
            State data if valid, None otherwise
        """
        if not encrypted_state or not cookie_nonce:
            return None

        try:
            # Decrypt state
            decrypted = self.cipher.decrypt(encrypted_state.encode("utf-8"))
            state_data = json.loads(decrypted.decode("utf-8"))

            # Validate required fields
            required_fields = ["redirect_url", "nonce", "timestamp", "domain"]
            if not all(field in state_data for field in required_fields):
                return None

            # Validate timestamp (check age)
            state_age = int(time.time()) - state_data["timestamp"]
            if state_age > max_age_seconds:
                return None

            # Validate nonce matches cookie
            if state_data["nonce"] != cookie_nonce:
                return None

            return state_data

        except Exception:
            return None

    def generate_nonce(self) -> str:
        """
        Generate a cryptographically secure nonce.

        Returns:
            URL-safe random string
        """
        return secrets.token_urlsafe(32)


def create_state_encryption_key() -> bytes:
    """
    Generate a new Fernet encryption key for state parameters.

    Returns:
        32-byte Fernet key
    """
    return Fernet.generate_key()


def encode_state_key_for_storage(key: bytes) -> str:
    """
    Encode Fernet key for storage in AWS Secrets Manager.

    Args:
        key: Fernet encryption key

    Returns:
        Base64 encoded key string (Fernet keys are already base64)
    """
    return key.decode("utf-8")


def decode_state_key_from_storage(encoded_key: str) -> bytes:
    """
    Decode Fernet key from AWS Secrets Manager.

    Args:
        encoded_key: Base64 encoded Fernet key

    Returns:
        Fernet encryption key

    Raises:
        ValueError: If key is not valid Fernet key
    """
    try:
        key = encoded_key.encode("utf-8")
        # Validate by creating a Fernet instance
        Fernet(key)
        return key
    except Exception as e:
        raise ValueError(f"Invalid Fernet key: {e}")
