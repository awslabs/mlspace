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
Tests for AWS Secrets Manager rotation handlers.
"""

from unittest import mock

import pytest

from ml_space_lambda.auth.models.key_models import KeyStatusResult, KeyType, VersionedKeyData
from ml_space_lambda.auth.utils.rotation_handlers import (
    RotationStep,
    _handle_create_secret_step,
    _handle_finish_secret_step,
    _handle_set_secret_step,
    _handle_test_secret_step,
    _validate_rotation_event,
    initialize_secret_handler,
    state_key_secrets_manager_rotation_handler,
    token_key_secrets_manager_rotation_handler,
)


@pytest.fixture
def mock_rotation_functions():
    """Mock all rotation-related functions."""
    with mock.patch(
        "ml_space_lambda.auth.utils.rotation_handlers.rotate_state_encryption_key"
    ) as mock_rotate_state, mock.patch(
        "ml_space_lambda.auth.utils.rotation_handlers.rotate_token_encryption_key"
    ) as mock_rotate_token, mock.patch(
        "ml_space_lambda.auth.utils.rotation_handlers.get_key_status"
    ) as mock_get_status, mock.patch(
        "ml_space_lambda.auth.utils.rotation_handlers.finalize_secrets_manager_rotation"
    ) as mock_finalize, mock.patch(
        "ml_space_lambda.auth.utils.rotation_handlers.initialize_state_encryption_key"
    ) as mock_init_state, mock.patch(
        "ml_space_lambda.auth.utils.rotation_handlers.initialize_token_encryption_key"
    ) as mock_init_token:

        yield {
            "rotate_state": mock_rotate_state,
            "rotate_token": mock_rotate_token,
            "get_status": mock_get_status,
            "finalize": mock_finalize,
            "init_state": mock_init_state,
            "init_token": mock_init_token,
        }


@pytest.fixture
def sample_versioned_key_data():
    """Sample versioned key data for testing."""
    return VersionedKeyData.create_initial(encoded_key="test-encoded-key-123", key_type=KeyType.TOKEN, created_by="test_user")


class TestValidateRotationEvent:
    """Tests for _validate_rotation_event function."""

    def test_validate_event_success(self):
        """Test successful event validation."""
        event = {
            "SecretId": "arn:aws:secretsmanager:us-east-1:123456789012:secret:test",
            "Step": "createSecret",
            "ClientRequestToken": "test-token-123",
        }

        secret_name, step, version_token = _validate_rotation_event(event)

        assert secret_name == "arn:aws:secretsmanager:us-east-1:123456789012:secret:test"
        assert step == RotationStep.CREATE_SECRET
        assert version_token == "test-token-123"

    def test_validate_event_without_token(self):
        """Test event validation without version token."""
        event = {
            "SecretId": "arn:aws:secretsmanager:us-east-1:123456789012:secret:test",
            "Step": "createSecret",
        }

        secret_name, step, version_token = _validate_rotation_event(event)

        assert secret_name == "arn:aws:secretsmanager:us-east-1:123456789012:secret:test"
        assert step == RotationStep.CREATE_SECRET
        assert version_token is None

    def test_validate_event_missing_secret_id(self):
        """Test validation with missing SecretId."""
        event = {"Step": "createSecret"}

        with pytest.raises(ValueError, match="SecretId is required"):
            _validate_rotation_event(event)

    def test_validate_event_missing_step(self):
        """Test validation with missing Step."""
        event = {"SecretId": "arn:aws:secretsmanager:us-east-1:123456789012:secret:test"}

        with pytest.raises(ValueError, match="Step is required"):
            _validate_rotation_event(event)

    def test_validate_event_invalid_step(self):
        """Test validation with invalid step."""
        event = {
            "SecretId": "arn:aws:secretsmanager:us-east-1:123456789012:secret:test",
            "Step": "invalidStep",
        }

        with pytest.raises(ValueError, match="Invalid rotation step"):
            _validate_rotation_event(event)

    def test_validate_all_rotation_steps(self):
        """Test validation for all valid rotation steps."""
        secret_id = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test"
        steps = ["createSecret", "setSecret", "testSecret", "finishSecret"]

        for step_name in steps:
            event = {"SecretId": secret_id, "Step": step_name}
            secret_name, step, version_token = _validate_rotation_event(event)
            assert secret_name == secret_id
            assert isinstance(step, RotationStep)


class TestHandleCreateSecretStep:
    """Tests for _handle_create_secret_step function."""

    def test_create_secret_state_key(self, mock_rotation_functions):
        """Test creating secret for state key."""
        secret_name = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test"

        _handle_create_secret_step(secret_name, KeyType.STATE)

        mock_rotation_functions["rotate_state"].assert_called_once_with(secret_name, version_token=None, keep_versions=3)

    def test_create_secret_token_key(self, mock_rotation_functions):
        """Test creating secret for token key."""
        secret_name = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test"

        _handle_create_secret_step(secret_name, KeyType.TOKEN)

        mock_rotation_functions["rotate_token"].assert_called_once_with(secret_name, version_token=None, keep_versions=3)

    def test_create_secret_with_version_token(self, mock_rotation_functions):
        """Test creating secret with version token."""
        secret_name = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test"
        version_token = "test-token-123"

        _handle_create_secret_step(secret_name, KeyType.STATE, version_token)

        mock_rotation_functions["rotate_state"].assert_called_once_with(
            secret_name, version_token=version_token, keep_versions=3
        )


class TestHandleSetSecretStep:
    """Tests for _handle_set_secret_step function."""

    def test_set_secret_step(self):
        """Test set secret step (no-op)."""
        secret_name = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test"

        # Should not raise any exceptions
        _handle_set_secret_step(secret_name)


class TestHandleTestSecretStep:
    """Tests for _handle_test_secret_step function."""

    def test_test_secret_success(self, mock_rotation_functions):
        """Test successful secret validation."""
        secret_name = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test"

        mock_rotation_functions["get_status"].return_value = KeyStatusResult(
            success=True, current_version=2, total_versions=2, key_type=KeyType.TOKEN
        )

        _handle_test_secret_step(secret_name)

        mock_rotation_functions["get_status"].assert_called_once()

    def test_test_secret_failure(self, mock_rotation_functions):
        """Test secret validation failure."""
        secret_name = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test"

        mock_rotation_functions["get_status"].return_value = KeyStatusResult(success=False, error="Validation failed")

        with pytest.raises(Exception, match="Failed to validate key"):
            _handle_test_secret_step(secret_name)


class TestHandleFinishSecretStep:
    """Tests for _handle_finish_secret_step function."""

    def test_finish_secret_success(self, mock_rotation_functions):
        """Test successful secret finalization."""
        secret_name = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test"

        _handle_finish_secret_step(secret_name)

        mock_rotation_functions["finalize"].assert_called_once_with(secret_name)

    def test_finish_secret_failure(self, mock_rotation_functions):
        """Test secret finalization failure."""
        secret_name = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test"

        mock_rotation_functions["finalize"].side_effect = Exception("Finalization failed")

        with pytest.raises(Exception, match="Finalization failed"):
            _handle_finish_secret_step(secret_name)


class TestStateKeySecretsManagerRotationHandler:
    """Tests for state_key_secrets_manager_rotation_handler function."""

    def test_handler_create_secret_step(self, mock_rotation_functions):
        """Test handler with createSecret step."""
        event = {
            "SecretId": "arn:aws:secretsmanager:us-east-1:123456789012:secret:test",
            "Step": "createSecret",
            "ClientRequestToken": "test-token",
        }

        state_key_secrets_manager_rotation_handler(event, None)

        mock_rotation_functions["rotate_state"].assert_called_once()

    def test_handler_set_secret_step(self, mock_rotation_functions):
        """Test handler with setSecret step."""
        event = {
            "SecretId": "arn:aws:secretsmanager:us-east-1:123456789012:secret:test",
            "Step": "setSecret",
        }

        state_key_secrets_manager_rotation_handler(event, None)

        # setSecret is a no-op, so no functions should be called
        mock_rotation_functions["rotate_state"].assert_not_called()

    def test_handler_test_secret_step(self, mock_rotation_functions):
        """Test handler with testSecret step."""
        event = {
            "SecretId": "arn:aws:secretsmanager:us-east-1:123456789012:secret:test",
            "Step": "testSecret",
        }

        mock_rotation_functions["get_status"].return_value = KeyStatusResult(
            success=True, current_version=2, total_versions=2, key_type=KeyType.STATE
        )

        state_key_secrets_manager_rotation_handler(event, None)

        mock_rotation_functions["get_status"].assert_called_once()

    def test_handler_finish_secret_step(self, mock_rotation_functions):
        """Test handler with finishSecret step."""
        event = {
            "SecretId": "arn:aws:secretsmanager:us-east-1:123456789012:secret:test",
            "Step": "finishSecret",
        }

        state_key_secrets_manager_rotation_handler(event, None)

        mock_rotation_functions["finalize"].assert_called_once()

    def test_handler_invalid_event(self):
        """Test handler with invalid event."""
        event = {"Step": "createSecret"}  # Missing SecretId

        with pytest.raises(ValueError, match="SecretId is required"):
            state_key_secrets_manager_rotation_handler(event, None)

    def test_handler_unknown_step(self):
        """Test handler with unknown step."""
        event = {
            "SecretId": "arn:aws:secretsmanager:us-east-1:123456789012:secret:test",
            "Step": "unknownStep",
        }

        with pytest.raises(ValueError, match="Invalid rotation step"):
            state_key_secrets_manager_rotation_handler(event, None)

    def test_handler_exception_during_rotation(self, mock_rotation_functions):
        """Test handler exception during rotation."""
        event = {
            "SecretId": "arn:aws:secretsmanager:us-east-1:123456789012:secret:test",
            "Step": "createSecret",
        }

        mock_rotation_functions["rotate_state"].side_effect = Exception("Rotation failed")

        with pytest.raises(Exception, match="Rotation failed"):
            state_key_secrets_manager_rotation_handler(event, None)


class TestTokenKeySecretsManagerRotationHandler:
    """Tests for token_key_secrets_manager_rotation_handler function."""

    def test_handler_create_secret_step(self, mock_rotation_functions):
        """Test handler with createSecret step."""
        event = {
            "SecretId": "arn:aws:secretsmanager:us-east-1:123456789012:secret:test",
            "Step": "createSecret",
            "ClientRequestToken": "test-token",
        }

        token_key_secrets_manager_rotation_handler(event, None)

        mock_rotation_functions["rotate_token"].assert_called_once()

    def test_handler_set_secret_step(self, mock_rotation_functions):
        """Test handler with setSecret step."""
        event = {
            "SecretId": "arn:aws:secretsmanager:us-east-1:123456789012:secret:test",
            "Step": "setSecret",
        }

        token_key_secrets_manager_rotation_handler(event, None)

        # setSecret is a no-op
        mock_rotation_functions["rotate_token"].assert_not_called()

    def test_handler_test_secret_step(self, mock_rotation_functions):
        """Test handler with testSecret step."""
        event = {
            "SecretId": "arn:aws:secretsmanager:us-east-1:123456789012:secret:test",
            "Step": "testSecret",
        }

        mock_rotation_functions["get_status"].return_value = KeyStatusResult(
            success=True, current_version=2, total_versions=2, key_type=KeyType.TOKEN
        )

        token_key_secrets_manager_rotation_handler(event, None)

        mock_rotation_functions["get_status"].assert_called_once()

    def test_handler_finish_secret_step(self, mock_rotation_functions):
        """Test handler with finishSecret step."""
        event = {
            "SecretId": "arn:aws:secretsmanager:us-east-1:123456789012:secret:test",
            "Step": "finishSecret",
        }

        token_key_secrets_manager_rotation_handler(event, None)

        mock_rotation_functions["finalize"].assert_called_once()

    def test_handler_all_steps_sequence(self, mock_rotation_functions):
        """Test handler with complete rotation sequence."""
        secret_id = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test"

        mock_rotation_functions["get_status"].return_value = KeyStatusResult(
            success=True, current_version=2, total_versions=2, key_type=KeyType.TOKEN
        )

        # Step 1: createSecret
        event = {"SecretId": secret_id, "Step": "createSecret", "ClientRequestToken": "token-1"}
        token_key_secrets_manager_rotation_handler(event, None)
        mock_rotation_functions["rotate_token"].assert_called_once()

        # Step 2: setSecret
        event = {"SecretId": secret_id, "Step": "setSecret"}
        token_key_secrets_manager_rotation_handler(event, None)

        # Step 3: testSecret
        event = {"SecretId": secret_id, "Step": "testSecret"}
        token_key_secrets_manager_rotation_handler(event, None)
        mock_rotation_functions["get_status"].assert_called_once()

        # Step 4: finishSecret
        event = {"SecretId": secret_id, "Step": "finishSecret"}
        token_key_secrets_manager_rotation_handler(event, None)
        mock_rotation_functions["finalize"].assert_called_once()

    def test_handler_exception_during_rotation(self, mock_rotation_functions):
        """Test handler exception during rotation."""
        event = {
            "SecretId": "arn:aws:secretsmanager:us-east-1:123456789012:secret:test",
            "Step": "createSecret",
        }

        mock_rotation_functions["rotate_token"].side_effect = Exception("Rotation failed")

        with pytest.raises(Exception, match="Rotation failed"):
            token_key_secrets_manager_rotation_handler(event, None)


class TestInitializeSecretHandler:
    """Tests for initialize_secret_handler function."""

    def test_initialize_state_key(self, mock_rotation_functions):
        """Test initializing state key."""
        event = {
            "secret_name": "arn:aws:secretsmanager:us-east-1:123456789012:secret:test",
            "key_type": KeyType.STATE,
        }

        mock_rotation_functions["init_state"].return_value = {
            "success": True,
            "key_type": KeyType.STATE,
            "initial_version": 1,
        }

        result = initialize_secret_handler(event, None)

        assert result["success"] is True
        assert result["key_type"] == KeyType.STATE
        mock_rotation_functions["init_state"].assert_called_once()

    def test_initialize_token_key(self, mock_rotation_functions):
        """Test initializing token key."""
        event = {
            "secret_name": "arn:aws:secretsmanager:us-east-1:123456789012:secret:test",
            "key_type": KeyType.TOKEN,
        }

        mock_rotation_functions["init_token"].return_value = {
            "success": True,
            "key_type": KeyType.TOKEN,
            "initial_version": 1,
        }

        result = initialize_secret_handler(event, None)

        assert result["success"] is True
        assert result["key_type"] == KeyType.TOKEN
        mock_rotation_functions["init_token"].assert_called_once()

    def test_initialize_default_key_type(self, mock_rotation_functions):
        """Test initializing with default key type (token)."""
        event = {"secret_name": "arn:aws:secretsmanager:us-east-1:123456789012:secret:test"}

        mock_rotation_functions["init_token"].return_value = {
            "success": True,
            "key_type": KeyType.TOKEN,
            "initial_version": 1,
        }

        result = initialize_secret_handler(event, None)

        assert result["success"] is True
        mock_rotation_functions["init_token"].assert_called_once()

    def test_initialize_missing_secret_name(self):
        """Test initialization with missing secret name."""
        event = {"key_type": KeyType.STATE}

        with pytest.raises(ValueError, match="secret_name is required"):
            initialize_secret_handler(event, None)

    def test_initialize_unknown_key_type(self):
        """Test initialization with unknown key type."""
        event = {
            "secret_name": "arn:aws:secretsmanager:us-east-1:123456789012:secret:test",
            "key_type": "unknown",
        }

        with pytest.raises(ValueError, match="Unknown key_type"):
            initialize_secret_handler(event, None)

    def test_initialize_exception(self, mock_rotation_functions):
        """Test initialization with exception."""
        event = {
            "secret_name": "arn:aws:secretsmanager:us-east-1:123456789012:secret:test",
            "key_type": KeyType.STATE,
        }

        mock_rotation_functions["init_state"].side_effect = Exception("Initialization failed")

        with pytest.raises(Exception, match="Initialization failed"):
            initialize_secret_handler(event, None)


class TestRotationStepEnum:
    """Tests for RotationStep enum."""

    def test_rotation_step_values(self):
        """Test rotation step enum values."""
        assert RotationStep.CREATE_SECRET == "createSecret"
        assert RotationStep.SET_SECRET == "setSecret"
        assert RotationStep.TEST_SECRET == "testSecret"
        assert RotationStep.FINISH_SECRET == "finishSecret"

    def test_rotation_step_from_string(self):
        """Test creating rotation step from string."""
        assert RotationStep("createSecret") == RotationStep.CREATE_SECRET
        assert RotationStep("setSecret") == RotationStep.SET_SECRET
        assert RotationStep("testSecret") == RotationStep.TEST_SECRET
        assert RotationStep("finishSecret") == RotationStep.FINISH_SECRET

    def test_rotation_step_invalid_value(self):
        """Test invalid rotation step value."""
        with pytest.raises(ValueError):
            RotationStep("invalidStep")
