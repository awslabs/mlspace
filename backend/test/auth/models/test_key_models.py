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
Tests for key management Pydantic models.
"""

from datetime import datetime, timezone

import pytest

from ml_space_lambda.auth.models.key_models import (
    KeyCleanupResult,
    KeyRotationResult,
    KeyStatusResult,
    KeyType,
    VersionedKeyData,
)


class TestVersionedKeyData:
    """Test cases for VersionedKeyData model."""

    def test_create_initial(self):
        """Test creating initial key data."""
        key_data = VersionedKeyData.create_initial(encoded_key="test-key-1", key_type=KeyType.TOKEN, created_by="test")

        assert key_data.current_version == 1
        assert key_data.keys == {"1": "test-key-1"}
        assert key_data.key_type == KeyType.TOKEN
        assert key_data.created_by == "test"
        assert key_data.rotation_date is None

    def test_get_current_key(self):
        """Test getting current key."""
        key_data = VersionedKeyData.create_initial("test-key", KeyType.STATE)

        current_key = key_data.get_current_key()
        assert current_key == "test-key"

    def test_get_current_key_missing(self):
        """Test getting current key when version is missing."""
        key_data = VersionedKeyData(current_version=2, keys={"1": "key-1"}, key_type=KeyType.TOKEN)

        with pytest.raises(ValueError, match="Current key version 2 not found"):
            key_data.get_current_key()

    def test_get_key_by_version(self):
        """Test getting key by specific version."""
        key_data = VersionedKeyData.create_initial("test-key", KeyType.TOKEN)

        key = key_data.get_key_by_version(1)
        assert key == "test-key"

        key = key_data.get_key_by_version(999)
        assert key is None

    def test_add_new_key_version(self):
        """Test adding new key version."""
        key_data = VersionedKeyData.create_initial("key-1", KeyType.STATE)

        new_version = key_data.add_new_key_version("key-2", "rotator")

        assert new_version == 2
        assert key_data.current_version == 2
        assert key_data.keys["2"] == "key-2"
        assert key_data.rotated_by == "rotator"
        assert key_data.rotation_date is not None

    def test_cleanup_old_versions(self):
        """Test cleaning up old key versions."""
        key_data = VersionedKeyData(
            current_version=5,
            keys={"1": "key-1", "2": "key-2", "3": "key-3", "4": "key-4", "5": "key-5"},
            key_type=KeyType.TOKEN,
        )

        removed = key_data.cleanup_old_versions(keep_versions=3)

        assert set(removed) == {"1", "2"}
        assert set(key_data.keys.keys()) == {"3", "4", "5"}
        assert key_data.last_cleanup is not None

    def test_cleanup_no_versions_to_remove(self):
        """Test cleanup when no versions need to be removed."""
        key_data = VersionedKeyData.create_initial("key-1", KeyType.STATE)

        removed = key_data.cleanup_old_versions(keep_versions=3)

        assert removed == []
        assert len(key_data.keys) == 1

    def test_cleanup_invalid_keep_versions(self):
        """Test cleanup with invalid keep_versions parameter."""
        key_data = VersionedKeyData.create_initial("key-1", KeyType.TOKEN)

        with pytest.raises(ValueError, match="Must keep at least 1 version"):
            key_data.cleanup_old_versions(keep_versions=0)

    def test_get_available_versions(self):
        """Test getting available versions."""
        key_data = VersionedKeyData(current_version=3, keys={"1": "key-1", "3": "key-3", "2": "key-2"}, key_type=KeyType.STATE)

        versions = key_data.get_available_versions()
        assert versions == [1, 2, 3]  # Should be sorted

    def test_get_total_versions(self):
        """Test getting total number of versions."""
        key_data = VersionedKeyData(current_version=2, keys={"1": "key-1", "2": "key-2"}, key_type=KeyType.TOKEN)

        total = key_data.get_total_versions()
        assert total == 2

    def test_serialization(self):
        """Test JSON serialization and deserialization."""
        original = VersionedKeyData.create_initial("test-key", KeyType.STATE)
        original.add_new_key_version("new-key", "test")

        # Serialize to JSON
        json_str = original.to_secrets_manager_format()

        # Deserialize from JSON
        restored = VersionedKeyData.from_secrets_manager_format(json_str)

        assert restored.current_version == original.current_version
        assert restored.keys == original.keys
        assert restored.key_type == original.key_type
        assert restored.created_by == original.created_by

    def test_validation_empty_keys(self):
        """Test validation fails with empty keys."""
        with pytest.raises(ValueError, match="Keys dictionary cannot be empty"):
            VersionedKeyData(current_version=1, keys={}, key_type=KeyType.TOKEN)


class TestResultModels:
    """Test cases for result models."""

    def test_key_rotation_result(self):
        """Test KeyRotationResult model."""
        result = KeyRotationResult(
            success=True,
            previous_version=1,
            new_version=2,
            rotation_date=datetime.now(timezone.utc),
            total_versions=2,
            message="Rotation successful",
        )

        assert result.success is True
        assert result.previous_version == 1
        assert result.new_version == 2
        assert result.message == "Rotation successful"

    def test_key_cleanup_result(self):
        """Test KeyCleanupResult model."""
        result = KeyCleanupResult(
            success=True, removed_versions=["1", "2"], kept_versions=["3", "4"], message="Cleanup successful"
        )

        assert result.success is True
        assert result.removed_versions == ["1", "2"]
        assert result.kept_versions == ["3", "4"]

    def test_key_status_result_success(self):
        """Test KeyStatusResult model for successful status."""
        result = KeyStatusResult(
            success=True,
            current_version=3,
            total_versions=3,
            available_versions=[1, 2, 3],
            key_type=KeyType.TOKEN,
            last_rotation=datetime.now(timezone.utc),
        )

        assert result.success is True
        assert result.current_version == 3
        assert result.key_type == KeyType.TOKEN
        assert result.error is None

    def test_key_status_result_error(self):
        """Test KeyStatusResult model for error case."""
        result = KeyStatusResult(success=False, error="Failed to retrieve key status")

        assert result.success is False
        assert result.error == "Failed to retrieve key status"
        assert result.current_version is None
