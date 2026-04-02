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
Tests for key rotation utilities.
"""

import json
from datetime import datetime
from unittest import mock

import pytest
from botocore.exceptions import ClientError

from ml_space_lambda.auth.models.key_models import (
    KeyRotationResult,
    KeyStatusResult,
    KeyType,
    SecretsManagerStage,
    VersionedKeyData,
)
from ml_space_lambda.auth.utils.key_rotation import (
    finalize_secrets_manager_rotation,
    get_key_status,
    initialize_state_encryption_key,
    initialize_token_encryption_key,
    rotate_state_encryption_key,
    rotate_token_encryption_key,
    state_key_rotation_handler,
    token_key_rotation_handler,
)


@pytest.fixture
def mock_secrets_client():
    """Mock boto3 secrets manager client."""
    with mock.patch("boto3.client") as mock_client:
        yield mock_client.return_value


@pytest.fixture
def sample_versioned_key_data():
    """Sample versioned key data for testing."""
    return VersionedKeyData.create_initial(encoded_key="test-encoded-key-123", key_type=KeyType.TOKEN, created_by="test_user")


class TestInitializeStateEncryptionKey:
    """Tests for initialize_state_encryption_key function."""

    def test_initialize_state_key_success(self, mock_secrets_client):
        """Test successful state key initialization."""
        secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-state-key"
        mock_secrets_client.get_secret_value.return_value = {"SecretString": ""}

        result = initialize_state_encryption_key(secret_arn)

        assert result["success"] is True
        assert result["key_type"] == KeyType.STATE
        assert result["initial_version"] == 1
        assert "created_date" in result

        mock_secrets_client.update_secret.assert_called_once()
        call_args = mock_secrets_client.update_secret.call_args
        assert call_args[1]["SecretId"] == secret_arn
        assert "SecretString" in call_args[1]

    def test_initialize_state_key_skips_when_already_versioned(self, mock_secrets_client):
        """Plaintext or legacy secrets are replaced; valid versioned JSON is left unchanged."""
        secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-state-key"
        existing = VersionedKeyData.create_initial(encoded_key="existing", key_type=KeyType.STATE)
        mock_secrets_client.get_secret_value.return_value = {"SecretString": existing.to_secrets_manager_format()}

        result = initialize_state_encryption_key(secret_arn)

        assert result["success"] is True
        assert result.get("skipped") is True
        mock_secrets_client.update_secret.assert_not_called()

    def test_initialize_state_key_propagates_get_secret_client_error(self, mock_secrets_client):
        """Throttling or permission errors from GetSecretValue must not be treated as 'not versioned'."""
        secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-state-key"
        mock_secrets_client.get_secret_value.side_effect = ClientError(
            {"Error": {"Code": "ThrottlingException", "Message": "Slow down"}},
            "GetSecretValue",
        )

        with pytest.raises(ClientError):
            initialize_state_encryption_key(secret_arn)

        mock_secrets_client.update_secret.assert_not_called()

    def test_initialize_state_key_failure(self, mock_secrets_client):
        """Test state key initialization failure."""
        secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-state-key"
        mock_secrets_client.get_secret_value.return_value = {"SecretString": ""}
        mock_secrets_client.update_secret.side_effect = Exception("AWS error")

        with pytest.raises(Exception, match="State key initialization failed"):
            initialize_state_encryption_key(secret_arn)


class TestInitializeTokenEncryptionKey:
    """Tests for initialize_token_encryption_key function."""

    def test_initialize_token_key_success(self, mock_secrets_client):
        """Test successful token key initialization."""
        secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-token-key"
        mock_secrets_client.get_secret_value.return_value = {"SecretString": ""}

        result = initialize_token_encryption_key(secret_arn)

        assert result["success"] is True
        assert result["key_type"] == KeyType.TOKEN
        assert result["initial_version"] == 1
        assert "created_date" in result

        mock_secrets_client.update_secret.assert_called_once()

    def test_initialize_token_key_skips_when_already_versioned(self, mock_secrets_client):
        secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-token-key"
        existing = VersionedKeyData.create_initial(encoded_key="existing", key_type=KeyType.TOKEN)
        mock_secrets_client.get_secret_value.return_value = {"SecretString": existing.to_secrets_manager_format()}

        result = initialize_token_encryption_key(secret_arn)

        assert result["success"] is True
        assert result.get("skipped") is True
        mock_secrets_client.update_secret.assert_not_called()

    def test_initialize_token_key_failure(self, mock_secrets_client):
        """Test token key initialization failure."""
        secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-token-key"
        mock_secrets_client.get_secret_value.return_value = {"SecretString": ""}
        mock_secrets_client.update_secret.side_effect = Exception("AWS error")

        with pytest.raises(Exception, match="Token key initialization failed"):
            initialize_token_encryption_key(secret_arn)


class TestRotateStateEncryptionKey:
    """Tests for rotate_state_encryption_key function."""

    def test_rotate_state_key_success(self, mock_secrets_client, sample_versioned_key_data):
        """Test successful state key rotation."""
        secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-state-key"

        mock_secrets_client.get_secret_value.return_value = {
            "SecretString": sample_versioned_key_data.to_secrets_manager_format()
        }

        result = rotate_state_encryption_key(secret_arn)

        assert isinstance(result, KeyRotationResult)
        assert result.success is True
        assert result.previous_version == 1
        assert result.new_version == 2
        assert result.total_versions == 2

        mock_secrets_client.put_secret_value.assert_called_once()
        call_args = mock_secrets_client.put_secret_value.call_args
        assert call_args[1]["SecretId"] == secret_arn
        assert SecretsManagerStage.PENDING in call_args[1]["VersionStages"]

    def test_rotate_state_key_with_version_token(self, mock_secrets_client, sample_versioned_key_data):
        """Test state key rotation with version token."""
        secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-state-key"
        version_token = "test-version-token-123"

        mock_secrets_client.get_secret_value.return_value = {
            "SecretString": sample_versioned_key_data.to_secrets_manager_format()
        }

        result = rotate_state_encryption_key(secret_arn, version_token=version_token)

        assert result.success is True
        call_args = mock_secrets_client.put_secret_value.call_args
        assert call_args[1]["ClientRequestToken"] == version_token

    def test_rotate_state_key_with_cleanup(self, mock_secrets_client):
        """Test state key rotation with old version cleanup."""
        secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-state-key"

        # Create key data with multiple versions
        key_data = VersionedKeyData.create_initial("key1", KeyType.STATE)
        key_data.add_new_key_version("key2")
        key_data.add_new_key_version("key3")
        key_data.add_new_key_version("key4")

        mock_secrets_client.get_secret_value.return_value = {"SecretString": key_data.to_secrets_manager_format()}

        result = rotate_state_encryption_key(secret_arn, keep_versions=3)

        assert result.success is True
        assert result.new_version == 5
        # Should keep only 3 most recent versions
        assert result.total_versions == 3

    def test_rotate_state_key_first_rotation(self, mock_secrets_client):
        """Test state key rotation when no existing key data."""
        secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-state-key"

        mock_secrets_client.get_secret_value.side_effect = Exception("Secret not found")

        result = rotate_state_encryption_key(secret_arn)

        assert result.success is True
        assert result.previous_version == 0
        assert result.new_version == 1
        # rotation_date should be None for initial creation
        assert result.rotation_date is None or isinstance(result.rotation_date, datetime)

    def test_rotate_state_key_failure(self, mock_secrets_client):
        """Test state key rotation failure."""
        secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-state-key"
        mock_secrets_client.put_secret_value.side_effect = Exception("AWS error")

        with pytest.raises(Exception, match="State key rotation failed"):
            rotate_state_encryption_key(secret_arn)


class TestRotateTokenEncryptionKey:
    """Tests for rotate_token_encryption_key function."""

    def test_rotate_token_key_success(self, mock_secrets_client, sample_versioned_key_data):
        """Test successful token key rotation."""
        secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-token-key"

        mock_secrets_client.get_secret_value.return_value = {
            "SecretString": sample_versioned_key_data.to_secrets_manager_format()
        }

        result = rotate_token_encryption_key(secret_arn)

        assert isinstance(result, KeyRotationResult)
        assert result.success is True
        assert result.previous_version == 1
        assert result.new_version == 2

        mock_secrets_client.put_secret_value.assert_called_once()

    def test_rotate_token_key_with_custom_stage(self, mock_secrets_client, sample_versioned_key_data):
        """Test token key rotation with custom version stage."""
        secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-token-key"
        custom_stage = "CUSTOM_STAGE"

        mock_secrets_client.get_secret_value.return_value = {
            "SecretString": sample_versioned_key_data.to_secrets_manager_format()
        }

        result = rotate_token_encryption_key(secret_arn, version_stage=custom_stage)

        assert result.success is True
        call_args = mock_secrets_client.put_secret_value.call_args
        assert custom_stage in call_args[1]["VersionStages"]

    def test_rotate_token_key_failure(self, mock_secrets_client):
        """Test token key rotation failure."""
        secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-token-key"
        mock_secrets_client.put_secret_value.side_effect = Exception("AWS error")

        with pytest.raises(Exception, match="Token key rotation failed"):
            rotate_token_encryption_key(secret_arn)


class TestFinalizeSecretsManagerRotation:
    """Tests for finalize_secrets_manager_rotation function."""

    def test_finalize_rotation_success(self, mock_secrets_client):
        """Test successful rotation finalization."""
        secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-key"

        mock_secrets_client.describe_secret.return_value = {
            "VersionIdsToStages": {
                "version-1": [SecretsManagerStage.CURRENT],
                "version-2": [SecretsManagerStage.PENDING],
            }
        }

        finalize_secrets_manager_rotation(secret_arn)

        # Should call update_secret_version_stage twice
        assert mock_secrets_client.update_secret_version_stage.call_count == 2

    def test_finalize_rotation_no_pending_version(self, mock_secrets_client):
        """Test finalization when no pending version exists."""
        secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-key"

        mock_secrets_client.describe_secret.return_value = {"VersionIdsToStages": {"version-1": [SecretsManagerStage.CURRENT]}}

        with pytest.raises(Exception, match="No version found with stage"):
            finalize_secrets_manager_rotation(secret_arn)

    def test_finalize_rotation_no_current_version(self, mock_secrets_client):
        """Test finalization when no current version exists."""
        secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-key"

        mock_secrets_client.describe_secret.return_value = {"VersionIdsToStages": {"version-1": [SecretsManagerStage.PENDING]}}

        finalize_secrets_manager_rotation(secret_arn)

        # Should still succeed, just without removing from current
        assert mock_secrets_client.update_secret_version_stage.call_count == 2

    def test_finalize_rotation_failure(self, mock_secrets_client):
        """Test rotation finalization failure."""
        secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-key"
        mock_secrets_client.describe_secret.side_effect = Exception("AWS error")

        with pytest.raises(Exception, match="AWS error"):
            finalize_secrets_manager_rotation(secret_arn)


class TestGetKeyStatus:
    """Tests for get_key_status function."""

    def test_get_key_status_success(self, mock_secrets_client, sample_versioned_key_data):
        """Test successful key status retrieval."""
        secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-key"

        mock_secrets_client.get_secret_value.return_value = {
            "SecretString": sample_versioned_key_data.to_secrets_manager_format()
        }

        result = get_key_status(secret_arn, SecretsManagerStage.CURRENT)

        assert isinstance(result, KeyStatusResult)
        assert result.success is True
        assert result.current_version == 1
        assert result.total_versions == 1
        assert result.key_type == KeyType.TOKEN

    def test_get_key_status_with_multiple_versions(self, mock_secrets_client):
        """Test key status with multiple versions."""
        secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-key"

        key_data = VersionedKeyData.create_initial("key1", KeyType.STATE)
        key_data.add_new_key_version("key2")
        key_data.add_new_key_version("key3")

        mock_secrets_client.get_secret_value.return_value = {"SecretString": key_data.to_secrets_manager_format()}

        result = get_key_status(secret_arn, SecretsManagerStage.CURRENT)

        assert result.success is True
        assert result.current_version == 3
        assert result.total_versions == 3
        assert result.available_versions == [1, 2, 3]

    def test_get_key_status_failure(self, mock_secrets_client):
        """Test key status retrieval failure."""
        secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-key"
        mock_secrets_client.get_secret_value.side_effect = Exception("AWS error")

        result = get_key_status(secret_arn, SecretsManagerStage.CURRENT)

        assert result.success is False
        assert result.error is not None


class TestStateKeyRotationHandler:
    """Tests for state_key_rotation_handler Lambda function."""

    def test_handler_initialize_action(self, mock_secrets_client):
        """Test handler with initialize action."""
        event = {"action": "initialize", "secret_arn": "arn:aws:secretsmanager:us-east-1:123456789012:secret:test"}

        response = state_key_rotation_handler(event, None)

        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["success"] is True
        assert body["key_type"] == KeyType.STATE

    def test_handler_rotate_action(self, mock_secrets_client, sample_versioned_key_data):
        """Test handler with rotate action."""
        event = {
            "action": "rotate",
            "secret_arn": "arn:aws:secretsmanager:us-east-1:123456789012:secret:test",
            "keep_versions": 3,
        }

        mock_secrets_client.get_secret_value.return_value = {
            "SecretString": sample_versioned_key_data.to_secrets_manager_format()
        }

        response = state_key_rotation_handler(event, None)

        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["success"] is True

    def test_handler_status_action(self, mock_secrets_client, sample_versioned_key_data):
        """Test handler with status action."""
        event = {"action": "status", "secret_arn": "arn:aws:secretsmanager:us-east-1:123456789012:secret:test"}

        mock_secrets_client.get_secret_value.return_value = {
            "SecretString": sample_versioned_key_data.to_secrets_manager_format()
        }

        response = state_key_rotation_handler(event, None)

        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["success"] is True

    def test_handler_missing_parameters(self):
        """Test handler with missing parameters."""
        event = {"action": "initialize"}

        response = state_key_rotation_handler(event, None)

        assert response["statusCode"] == 400
        body = json.loads(response["body"])
        assert "error" in body

    def test_handler_unknown_action(self):
        """Test handler with unknown action."""
        event = {"action": "unknown", "secret_arn": "arn:aws:secretsmanager:us-east-1:123456789012:secret:test"}

        response = state_key_rotation_handler(event, None)

        assert response["statusCode"] == 400
        body = json.loads(response["body"])
        assert "Unknown action" in body["error"]

    def test_handler_exception(self, mock_secrets_client):
        """Test handler with exception."""
        event = {"action": "initialize", "secret_arn": "arn:aws:secretsmanager:us-east-1:123456789012:secret:test"}

        mock_secrets_client.update_secret.side_effect = Exception("AWS error")

        response = state_key_rotation_handler(event, None)

        assert response["statusCode"] == 500
        body = json.loads(response["body"])
        assert "error" in body


class TestTokenKeyRotationHandler:
    """Tests for token_key_rotation_handler Lambda function."""

    def test_handler_initialize_action(self, mock_secrets_client):
        """Test handler with initialize action."""
        event = {"action": "initialize", "secret_arn": "arn:aws:secretsmanager:us-east-1:123456789012:secret:test"}

        response = token_key_rotation_handler(event, None)

        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["success"] is True
        assert body["key_type"] == KeyType.TOKEN

    def test_handler_rotate_action(self, mock_secrets_client, sample_versioned_key_data):
        """Test handler with rotate action."""
        event = {
            "action": "rotate",
            "secret_arn": "arn:aws:secretsmanager:us-east-1:123456789012:secret:test",
            "keep_versions": 3,
        }

        mock_secrets_client.get_secret_value.return_value = {
            "SecretString": sample_versioned_key_data.to_secrets_manager_format()
        }

        response = token_key_rotation_handler(event, None)

        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["success"] is True

    def test_handler_status_action(self, mock_secrets_client, sample_versioned_key_data):
        """Test handler with status action."""
        event = {"action": "status", "secret_arn": "arn:aws:secretsmanager:us-east-1:123456789012:secret:test"}

        mock_secrets_client.get_secret_value.return_value = {
            "SecretString": sample_versioned_key_data.to_secrets_manager_format()
        }

        response = token_key_rotation_handler(event, None)

        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["success"] is True

    def test_handler_missing_parameters(self):
        """Test handler with missing parameters."""
        event = {"action": "rotate"}

        response = token_key_rotation_handler(event, None)

        assert response["statusCode"] == 400
        body = json.loads(response["body"])
        assert "error" in body

    def test_handler_exception(self, mock_secrets_client):
        """Test handler with exception."""
        event = {"action": "initialize", "secret_arn": "arn:aws:secretsmanager:us-east-1:123456789012:secret:test"}

        mock_secrets_client.update_secret.side_effect = Exception("AWS error")

        response = token_key_rotation_handler(event, None)

        assert response["statusCode"] == 500
        body = json.loads(response["body"])
        assert "error" in body
