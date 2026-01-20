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
Initialize authentication encryption keys for MLSpace BFF authentication.

This script should be run after CDK deployment to populate the secrets
with proper encryption keys generated using the authentication utilities.
"""

import json
import sys
from pathlib import Path

import boto3

# Add the backend source to Python path
backend_path = Path(__file__).parent.parent / "backend" / "src"
sys.path.insert(0, str(backend_path))

from ml_space_lambda.auth.session.encryption import create_encryption_key, encode_key_for_storage
from ml_space_lambda.auth.utils.state import create_state_encryption_key, encode_state_key_for_storage


def initialize_state_encryption_key(secret_arn: str):
    """Initialize state encryption secret with proper Fernet key."""
    print(f"Initializing state encryption key: {secret_arn}")

    # Generate proper Fernet key
    encryption_key = create_state_encryption_key()
    encoded_key = encode_state_key_for_storage(encryption_key)

    # Store in Secrets Manager
    secrets_client = boto3.client("secretsmanager")
    secret_value = json.dumps({"key": encoded_key})

    try:
        secrets_client.update_secret(SecretId=secret_arn, SecretString=secret_value)
        print(f"✅ State encryption key initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize state encryption key: {e}")
        return False

    return True


def initialize_token_encryption_keys(secret_arn: str):
    """Initialize token encryption secret with versioned key structure."""
    print(f"Initializing token encryption keys: {secret_arn}")

    # Generate initial token encryption key
    encryption_key = create_encryption_key()
    encoded_key = encode_key_for_storage(encryption_key)

    # Create versioned structure
    versioned_data = {
        "current_version": 1,
        "keys": {"1": encoded_key},
        "key_type": "token",
        "created_date": "2024-01-15T10:30:00Z",
        "created_by": "initialization_script",
    }

    # Store in Secrets Manager
    secrets_client = boto3.client("secretsmanager")
    secret_value = json.dumps(versioned_data)

    try:
        secrets_client.update_secret(SecretId=secret_arn, SecretString=secret_value)
        print(f"✅ Token encryption keys initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize token encryption keys: {e}")
        return False

    return True


def main():
    """Initialize both authentication encryption keys."""
    print("🔐 Initializing MLSpace BFF Authentication Keys")
    print("=" * 50)

    # Default secret ARNs (can be overridden via environment variables)
    state_secret_arn = "/mlspace/auth/state-encryption-key"
    token_secret_arn = "/mlspace/auth/token-encryption-keys"

    success = True

    # Initialize state encryption key
    if not initialize_state_encryption_key(state_secret_arn):
        success = False

    # Initialize token encryption keys
    if not initialize_token_encryption_keys(token_secret_arn):
        success = False

    if success:
        print("\n🎉 All authentication keys initialized successfully!")
        print("\nNext steps:")
        print("1. Deploy your MLSpace application")
        print("2. Keys will be automatically rotated according to schedule")
        print("3. Use the key rotation documentation for manual operations")
    else:
        print("\n💥 Some keys failed to initialize. Check the errors above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
