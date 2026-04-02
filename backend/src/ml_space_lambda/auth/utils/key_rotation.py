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
Key rotation utilities for encryption key management.

Provides separate functions for state and token key rotation with
domain-driven design using Pydantic models.
"""

import json
import logging
import os
from typing import Dict, Optional

import boto3
from botocore.exceptions import ClientError
from pydantic import ValidationError

from ml_space_lambda.auth.models.key_models import (
    KeyRotationResult,
    KeyStatusResult,
    KeyType,
    SecretsManagerStage,
    VersionedKeyData,
)
from ml_space_lambda.auth.session.encryption import create_encryption_key, encode_key_for_storage
from ml_space_lambda.auth.utils.state import create_state_encryption_key, encode_state_key_for_storage

logger = logging.getLogger(__name__)
logger.setLevel(level=logging.INFO)


def _get_default_keep_versions() -> int:
    """
    Get the default number of key versions to keep from environment variable.

    Returns:
        Number of versions to keep (default: 3)
    """
    try:
        return int(os.environ.get("AUTH_KEY_VERSIONS_TO_KEEP", "3"))
    except ValueError:
        logger.warning("Invalid AUTH_KEY_VERSIONS_TO_KEEP value, using default: 3")
        return 3


def _secret_already_versioned_for_type(secret_id: str, expected: KeyType, secrets_client) -> bool:
    """
    Return True if the secret string parses as VersionedKeyData with matching key_type and keys.

    AWS API and permission errors propagate so deploy does not overwrite a valid secret after a
    transient failure. Only empty, non-JSON, or structurally invalid payloads are treated as
    not-yet-versioned.
    """
    try:
        response = secrets_client.get_secret_value(SecretId=secret_id)
    except ClientError:
        raise

    raw = response.get("SecretString") or ""
    if not raw.strip():
        return False
    try:
        data = VersionedKeyData.from_secrets_manager_format(raw)
    except (json.JSONDecodeError, ValidationError, ValueError, TypeError) as e:
        logger.info(
            "Secret %s not in expected versioned JSON format; will initialize if needed: %s",
            secret_id,
            e,
        )
        return False
    return data.key_type == expected and bool(data.keys)


def initialize_state_encryption_key(secret_arn: str) -> Dict:
    """
    Initialize state encryption key secret with versioned structure.

    Args:
        secret_arn: AWS Secrets Manager ARN for state encryption key

    Returns:
        Dictionary with initialization details

    Raises:
        Exception: If initialization fails
    """
    try:
        secrets_client = boto3.client("secretsmanager")

        if _secret_already_versioned_for_type(secret_arn, KeyType.STATE, secrets_client):
            logger.info("State encryption secret already in versioned JSON format; skipping initialization.")
            return {
                "success": True,
                "skipped": True,
                "key_type": KeyType.STATE,
            }

        # Generate initial Fernet key
        initial_key = create_state_encryption_key()
        encoded_key = encode_state_key_for_storage(initial_key)

        # Create versioned key data using domain model
        key_data = VersionedKeyData.create_initial(
            encoded_key=encoded_key, key_type=KeyType.STATE, created_by="state_key_initializer"
        )

        # Store in Secrets Manager
        secrets_client.update_secret(SecretId=secret_arn, SecretString=key_data.to_secrets_manager_format())

        logger.info(f"Initialized state encryption key secret: {secret_arn}")

        return {
            "success": True,
            "key_type": KeyType.STATE,
            "initial_version": 1,
            "created_date": key_data.created_date.isoformat(),
        }

    except Exception as e:
        logger.error(f"State key initialization failed: {e}")
        raise Exception(f"State key initialization failed: {e}")


def initialize_token_encryption_key(secret_arn: str) -> Dict:
    """
    Initialize token encryption key secret with versioned structure.

    Args:
        secret_arn: AWS Secrets Manager ARN for token encryption key

    Returns:
        Dictionary with initialization details

    Raises:
        Exception: If initialization fails
    """
    try:
        secrets_client = boto3.client("secretsmanager")

        if _secret_already_versioned_for_type(secret_arn, KeyType.TOKEN, secrets_client):
            logger.info("Token encryption secret already in versioned JSON format; skipping initialization.")
            return {
                "success": True,
                "skipped": True,
                "key_type": KeyType.TOKEN,
            }

        # Generate initial PASETO key
        initial_key = create_encryption_key()
        encoded_key = encode_key_for_storage(initial_key)

        # Create versioned key data using domain model
        key_data = VersionedKeyData.create_initial(
            encoded_key=encoded_key, key_type=KeyType.TOKEN, created_by="token_key_initializer"
        )

        # Store in Secrets Manager
        secrets_client.update_secret(SecretId=secret_arn, SecretString=key_data.to_secrets_manager_format())

        logger.info(f"Initialized token encryption key secret: {secret_arn}")

        return {
            "success": True,
            "key_type": KeyType.TOKEN,
            "initial_version": 1,
            "created_date": key_data.created_date.isoformat(),
        }

    except Exception as e:
        logger.error(f"Token key initialization failed: {e}")
        raise Exception(f"Token key initialization failed: {e}")


def rotate_state_encryption_key(
    secret_arn: str,
    version_stage: str = SecretsManagerStage.PENDING,
    version_token: Optional[str] = None,
    keep_versions: Optional[int] = None,
) -> KeyRotationResult:
    """
    Rotate state encryption key for AWS Secrets Manager rotation protocol.

    This function works with Secrets Manager's rotation protocol by creating
    a new secret version with the AWSPENDING label.

    Args:
        secret_arn: AWS Secrets Manager ARN for state encryption key
        version_stage: Version stage (AWSPENDING for new version)
        version_token: Version token for the rotation
        keep_versions: Number of recent versions to keep after rotation (uses AUTH_KEY_VERSIONS_TO_KEEP env var if not specified)

    Returns:
        KeyRotationResult with rotation details

    Raises:
        Exception: If rotation fails
    """
    if keep_versions is None:
        keep_versions = _get_default_keep_versions()
    try:
        secrets_client = boto3.client("secretsmanager")

        # Generate new Fernet key
        new_key = create_state_encryption_key()
        encoded_new_key = encode_state_key_for_storage(new_key)

        try:
            # Get current key data (AWSCURRENT version)
            response = secrets_client.get_secret_value(SecretId=secret_arn, VersionStage=SecretsManagerStage.CURRENT)
            key_data = VersionedKeyData.from_secrets_manager_format(response["SecretString"])

            # Add new version using domain method
            previous_version = key_data.current_version
            new_version = key_data.add_new_key_version(encoded_key=encoded_new_key, rotated_by="token_key_rotator")
        except Exception:
            key_data = VersionedKeyData.create_initial(encoded_new_key, KeyType.STATE)
            previous_version = 0
            new_version = key_data.current_version

        # Cleanup old versions automatically
        removed_versions = key_data.cleanup_old_versions(keep_versions)

        call_params = {
            "SecretId": secret_arn,
            "SecretString": key_data.to_secrets_manager_format(),
            "VersionStages": [version_stage],
        }

        if version_token:
            call_params["ClientRequestToken"] = version_token

        # Put the new secret version with AWSPENDING stage
        secrets_client.put_secret_value(**call_params)

        logger.info(
            f"Token encryption key rotated: v{previous_version} -> v{new_version}, removed {len(removed_versions)} old versions"
        )

        return KeyRotationResult(
            success=True,
            previous_version=previous_version,
            new_version=new_version,
            rotation_date=key_data.rotation_date or key_data.created_date,
            total_versions=key_data.get_total_versions(),
            message=f"Rotated to version {new_version}, removed {len(removed_versions)} old versions",
        )

    except Exception as e:
        logger.error(f"State key rotation failed: {e}")
        raise Exception(f"State key rotation failed: {e}")


def rotate_token_encryption_key(
    secret_arn: str,
    version_stage: str = SecretsManagerStage.PENDING,
    version_token: Optional[str] = None,
    keep_versions: Optional[int] = None,
) -> KeyRotationResult:
    """
    Rotate token encryption key for AWS Secrets Manager rotation protocol.

    This function works with Secrets Manager's rotation protocol by creating
    a new secret version with the AWSPENDING label.

    Args:
        secret_arn: AWS Secrets Manager ARN for token encryption key
        version_stage: Version stage (AWSPENDING for new version)
        version_token: Version token (normally from ClientRequestToken)
        keep_versions: Number of recent versions to keep after rotation (uses AUTH_KEY_VERSIONS_TO_KEEP env var if not specified)

    Returns:
        KeyRotationResult with rotation details

    Raises:
        Exception: If rotation fails
    """
    if keep_versions is None:
        keep_versions = _get_default_keep_versions()
    try:
        secrets_client = boto3.client("secretsmanager")

        # Generate new PASETO key
        new_key = create_encryption_key()
        encoded_new_key = encode_key_for_storage(new_key)

        try:
            # Get current key data (AWSCURRENT version)
            response = secrets_client.get_secret_value(SecretId=secret_arn, VersionStage=SecretsManagerStage.CURRENT)
            key_data = VersionedKeyData.from_secrets_manager_format(response["SecretString"])

            # Add new version using domain method
            previous_version = key_data.current_version
            new_version = key_data.add_new_key_version(encoded_key=encoded_new_key, rotated_by="token_key_rotator")
        except Exception:
            key_data = VersionedKeyData.create_initial(encoded_new_key, KeyType.TOKEN)
            previous_version = 0
            new_version = key_data.current_version

        # Cleanup old versions automatically
        removed_versions = key_data.cleanup_old_versions(keep_versions)

        call_params = {
            "SecretId": secret_arn,
            "SecretString": key_data.to_secrets_manager_format(),
            "VersionStages": [version_stage],
        }

        if version_token:
            call_params["ClientRequestToken"] = version_token

        # Put the new secret version with AWSPENDING stage
        secrets_client.put_secret_value(**call_params)

        logger.info(
            f"Token encryption key rotated: v{previous_version} -> v{new_version}, removed {len(removed_versions)} old versions"
        )

        return KeyRotationResult(
            success=True,
            previous_version=previous_version,
            new_version=new_version,
            rotation_date=key_data.rotation_date or key_data.created_date,
            total_versions=key_data.get_total_versions(),
            message=f"Rotated to version {new_version}, removed {len(removed_versions)} old versions",
        )

    except Exception as e:
        logger.error(f"Token key rotation failed: {e}")
        raise Exception(f"Token key rotation failed: {e}")


def finalize_secrets_manager_rotation(secret_arn: str) -> None:
    """
    Finalize AWS Secrets Manager rotation by moving labels.

    This moves the AWSPENDING version to AWSCURRENT and removes old labels.

    Args:
        secret_arn: Secret ARN
        version_stage: Version stage to finalize
    """
    try:
        secrets_client = boto3.client("secretsmanager")

        # Get the version ID of the pending secret
        response = secrets_client.describe_secret(SecretId=secret_arn)
        pending_version_id = None
        current_version_id = None

        logger.info(f"stages = {json.dumps(response.get('VersionIdsToStages', {}))}")
        for v_id, v_stages in response.get("VersionIdsToStages", {}).items():
            logger.info(f"checking {v_id}: {v_stages}")
            if SecretsManagerStage.CURRENT in v_stages:
                logger.info(f"current_version_id={v_id}")
                current_version_id = v_id

            if SecretsManagerStage.PENDING in v_stages:
                logger.info(f"pending_version_id={v_id}")
                pending_version_id = v_id

        if not pending_version_id:
            raise Exception(f"No version found with stage {SecretsManagerStage.PENDING}")

        call_params = {}

        # add existing version id with label if it exists
        if current_version_id:
            call_params["RemoveFromVersionId"] = current_version_id

        logger.info(f"call_params={json.dumps(call_params)}")

        # Move the AWSPENDING version to AWSCURRENT
        secrets_client.update_secret_version_stage(
            SecretId=secret_arn, VersionStage=SecretsManagerStage.CURRENT, MoveToVersionId=pending_version_id, **call_params
        )

        # Remove AWSPENDING version
        if pending_version_id:
            secrets_client.update_secret_version_stage(
                SecretId=secret_arn, VersionStage=SecretsManagerStage.PENDING, RemoveFromVersionId=pending_version_id
            )

        logger.info(f"Finalized rotation for secret {secret_arn}, version {pending_version_id}")

        # Clean up old secret versions after successful rotation
        # cleanup_result = cleanup_old_secret_versions(secret_arn, keep_versions=3)
        # if cleanup_result["success"]:
        #     logger.info(f"Cleaned up {len(cleanup_result['deleted_versions'])} old secret versions")
        # else:
        #     logger.warning(f"Failed to cleanup old versions: {cleanup_result.get('error')}")

    except Exception as e:
        logger.error(f"Failed to finalize rotation: {e}")
        raise


def get_key_status(secret_arn: str, version_stage: str) -> KeyStatusResult:
    """
    Get status information about key versions.

    Args:
        secret_arn: AWS Secrets Manager ARN

    Returns:
        KeyStatusResult with key status information
    """
    try:
        secrets_client = boto3.client("secretsmanager")
        response = secrets_client.get_secret_value(SecretId=secret_arn, VersionStage=version_stage)
        key_data = VersionedKeyData.from_secrets_manager_format(response["SecretString"])

        return KeyStatusResult(
            success=True,
            current_version=key_data.current_version,
            total_versions=key_data.get_total_versions(),
            available_versions=key_data.get_available_versions(),
            key_type=key_data.key_type,
            last_rotation=key_data.rotation_date,
            last_cleanup=key_data.last_cleanup,
        )

    except Exception as e:
        logger.error(f"Failed to get key status: {e}")
        return KeyStatusResult(success=False, error=str(e))


def state_key_rotation_handler(event, context):
    """
    Lambda handler for state encryption key rotation.

    Expected event format:
    {
        "action": "initialize" | "rotate" | "status",
        "secret_arn": "arn:aws:secretsmanager:...",
        "keep_versions": 3  // for rotate action
    }
    """
    try:
        action = event.get("action")
        secret_arn = event.get("secret_arn")

        if not action or not secret_arn:
            return {"statusCode": 400, "body": json.dumps({"error": "Missing required parameters: action, secret_arn"})}

        if action == "initialize":
            result = initialize_state_encryption_key(secret_arn)
        elif action == "rotate":
            keep_versions = event.get("keep_versions", 3)
            token = event.get("token", SecretsManagerStage.PENDING)
            result = rotate_state_encryption_key(secret_arn, token, keep_versions)
            # Convert Pydantic model to dict for JSON serialization
            if isinstance(result, KeyRotationResult):
                result = result.model_dump()
        elif action == "status":
            version_stage = event.get("version_stage", SecretsManagerStage.CURRENT)
            result = get_key_status(secret_arn, version_stage)
            # Convert Pydantic model to dict for JSON serialization
            if isinstance(result, KeyStatusResult):
                result = result.model_dump()
        else:
            return {"statusCode": 400, "body": json.dumps({"error": f"Unknown action: {action}"})}

        return {"statusCode": 200, "body": json.dumps(result, default=str)}

    except Exception as e:
        logger.error(f"State key rotation Lambda failed: {e}")
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}


def token_key_rotation_handler(event, context):
    """
    Lambda handler for token encryption key rotation.

    Expected event format:
    {
        "action": "initialize" | "rotate" | "status",
        "secret_arn": "arn:aws:secretsmanager:...",
        "keep_versions": 3  // for rotate action
    }
    """
    try:
        action = event.get("action")
        secret_arn = event.get("secret_arn")

        if not action or not secret_arn:
            return {"statusCode": 400, "body": json.dumps({"error": "Missing required parameters: action, secret_arn"})}

        if action == "initialize":
            result = initialize_token_encryption_key(secret_arn)
        elif action == "rotate":
            keep_versions = event.get("keep_versions", 3)
            token = event.get("token", SecretsManagerStage.PENDING)
            result = rotate_token_encryption_key(secret_arn, token, keep_versions)
            # Convert Pydantic model to dict for JSON serialization
            if isinstance(result, KeyRotationResult):
                result = result.model_dump()
        elif action == "status":
            version_stage = event.get("version_stage", SecretsManagerStage.CURRENT)
            result = get_key_status(secret_arn, version_stage)
            # Convert Pydantic model to dict for JSON serialization
            if isinstance(result, KeyStatusResult):
                result = result.model_dump()
        else:
            return {"statusCode": 400, "body": json.dumps({"error": f"Unknown action: {action}"})}

        return {"statusCode": 200, "body": json.dumps(result, default=str)}

    except Exception as e:
        logger.error(f"Token key rotation Lambda failed: {e}")
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}
