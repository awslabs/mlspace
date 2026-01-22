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
AWS Secrets Manager rotation handlers for encryption keys.

Provides handlers that work with Secrets Manager's rotation schedule
to automatically rotate state and token encryption keys following the
standard AWS rotation protocol with steps: createSecret, setSecret, testSecret, finishSecret.
"""

import logging
from enum import StrEnum
from typing import Any, Dict, Optional

from ml_space_lambda.auth.models.key_models import KeyType, SecretsManagerStage
from ml_space_lambda.auth.utils.key_rotation import (
    finalize_secrets_manager_rotation,
    get_key_status,
    initialize_state_encryption_key,
    initialize_token_encryption_key,
    rotate_state_encryption_key,
    rotate_token_encryption_key,
)

logger = logging.getLogger(__name__)
logger.setLevel(level=logging.INFO)


class RotationStep(StrEnum):
    """AWS Secrets Manager rotation steps."""

    CREATE_SECRET = "createSecret"
    SET_SECRET = "setSecret"
    TEST_SECRET = "testSecret"
    FINISH_SECRET = "finishSecret"


def _validate_rotation_event(event: Dict[str, Any]) -> tuple[str, RotationStep, str]:
    """
    Validate and extract rotation event parameters.

    Args:
        event: Secrets Manager rotation event

    Returns:
        Tuple of (secret_name, step)

    Raises:
        ValueError: If required parameters are missing
    """
    secret_name = event.get("SecretId")
    step = event.get("Step")
    version_token = event.get("ClientRequestToken", None)

    if not secret_name:
        raise ValueError("SecretId is required in rotation event")

    if not step:
        raise ValueError("Step is required in rotation event")

    try:
        rotation_step = RotationStep(step)
    except ValueError:
        raise ValueError(f"Invalid rotation step: {step}")

    return secret_name, rotation_step, version_token


def _handle_create_secret_step(secret_name: str, key_type: str, version_token: Optional[str] = None) -> None:
    """
    Handle the createSecret step of rotation.

    Args:
        secret_name: Secret ARN
        key_type: Type of key being rotated
    """
    # Create new key version
    if key_type == KeyType.STATE:
        result = rotate_state_encryption_key(secret_name, version_token=version_token, keep_versions=3)
    else:  # token
        result = rotate_token_encryption_key(secret_name, version_token=version_token, keep_versions=3)


def _handle_set_secret_step(secret_name: str) -> None:
    """
    Handle the setSecret step of rotation.

    Args:
        secret_name: Secret ARN
    """
    # For our key rotation, the secret is already set during createSecret
    logger.info(f"Secret already set during creation")


def _handle_test_secret_step(secret_name: str) -> None:
    """
    Handle the testSecret step of rotation.

    Args:
        secret_name: Secret ARN
    """
    # Test the new key version by getting status
    status = get_key_status(secret_name, SecretsManagerStage.PENDING)
    if not status.success:
        raise Exception(f"Failed to validate key: {status.error}")

    logger.info(f"Key validation successful, current version: {status.current_version}")


def _handle_finish_secret_step(secret_name: str) -> None:
    """
    Handle the finishSecret step of rotation.

    Args:
        secret_name: Secret ARN
    """
    # Finalize the rotation by moving version labels
    finalize_secrets_manager_rotation(secret_name)
    logger.info(f"Key rotation completed successfully")


def state_key_secrets_manager_rotation_handler(event: Dict[str, Any], context: Any) -> None:
    """
    AWS Secrets Manager rotation handler for state encryption keys.

    This handler is called by Secrets Manager during the rotation process.
    It follows the standard rotation steps: createSecret, setSecret, testSecret, finishSecret.

    Args:
        event: Secrets Manager rotation event with SecretId, Step, and Token
        context: Lambda context
    """
    try:
        secret_name, step, version_token = _validate_rotation_event(event)

        logger.info(f"Starting state key rotation step: {step} for secret: {secret_name}")

        if step == RotationStep.CREATE_SECRET:
            _handle_create_secret_step(secret_name, KeyType.STATE, version_token)
        elif step == RotationStep.SET_SECRET:
            _handle_set_secret_step(secret_name)
        elif step == RotationStep.TEST_SECRET:
            _handle_test_secret_step(secret_name)
        elif step == RotationStep.FINISH_SECRET:
            _handle_finish_secret_step(secret_name)
        else:
            raise ValueError(f"Unknown rotation step: {step}")

        logger.info(f"State key rotation step {step} completed successfully")

    except Exception as e:
        logger.error(f"State key rotation failed at step {event.get('Step', 'unknown')}: {e}")
        raise


def token_key_secrets_manager_rotation_handler(event: Dict[str, Any], context: Any) -> None:
    """
    AWS Secrets Manager rotation handler for token encryption keys.

    This handler is called by Secrets Manager during the rotation process.
    It follows the standard rotation steps: createSecret, setSecret, testSecret, finishSecret.

    Args:
        event: Secrets Manager rotation event with SecretId, Step, and Token
        context: Lambda context
    """
    try:
        secret_name, step, version_token = _validate_rotation_event(event)

        logger.info(f"Starting token key rotation step: {step} for secret: {secret_name}")

        if step == RotationStep.CREATE_SECRET:
            _handle_create_secret_step(secret_name, KeyType.TOKEN, version_token)
        elif step == RotationStep.SET_SECRET:
            _handle_set_secret_step(secret_name)
        elif step == RotationStep.TEST_SECRET:
            _handle_test_secret_step(secret_name)
        elif step == RotationStep.FINISH_SECRET:
            _handle_finish_secret_step(secret_name)
        else:
            raise ValueError(f"Unknown rotation step: {step}")

        logger.info(f"Token key rotation step {step} completed successfully")

    except Exception as e:
        logger.error(f"Token key rotation failed at step {event.get('Step', 'unknown')}: {e}")
        raise


def initialize_secret_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handler for initializing secrets with proper key structures.

    This can be called manually or during deployment to initialize secrets.

    Args:
        event: Event containing secret_name and key_type
        context: Lambda context

    Returns:
        Initialization result
    """
    try:
        secret_name = event.get("secret_name")
        key_type = event.get("key_type", KeyType.TOKEN)

        if not secret_name:
            raise ValueError("secret_name is required")

        if key_type == KeyType.STATE:
            result = initialize_state_encryption_key(secret_name)
        elif key_type == KeyType.TOKEN:
            result = initialize_token_encryption_key(secret_name)
        else:
            raise ValueError(f"Unknown key_type: {key_type}")

        logger.info(f"Successfully initialized {key_type} key secret: {secret_name}")
        return result

    except Exception as e:
        logger.error(f"Secret initialization failed: {e}")
        raise
