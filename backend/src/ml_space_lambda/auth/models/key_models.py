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
Pydantic models for encryption key management.

Provides concrete classes for managing versioned encryption keys with
domain-driven design principles.
"""

from datetime import datetime, timezone
from enum import StrEnum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field, field_serializer, field_validator


class KeyType(StrEnum):
    """Enumeration of supported key types."""

    TOKEN = "token"
    STATE = "state"


class SecretsManagerStage(StrEnum):
    CURRENT = "AWSCURRENT"
    PREVIOUS = "AWSPREVIOUS"
    PENDING = "AWSPENDING"


class VersionedKeyData(BaseModel):
    """
    Represents versioned encryption key data with domain methods.

    This class encapsulates the key management logic and provides
    methods for rotating, cleaning up, and managing key versions.
    """

    current_version: int = Field(default=1, ge=1, description="Current active key version")
    keys: Dict[str, str] = Field(default_factory=dict, description="Mapping of version to encoded key")
    key_type: KeyType = Field(description="Type of encryption key")
    created_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str = Field(default="key_rotation_manager")
    rotation_date: Optional[datetime] = Field(default=None, description="Last rotation timestamp")
    rotated_by: Optional[str] = Field(default=None, description="Entity that performed last rotation")
    last_cleanup: Optional[datetime] = Field(default=None, description="Last cleanup timestamp")

    @field_validator("keys")
    @classmethod
    def validate_keys_not_empty(cls, v):
        """Ensure keys dictionary is not empty."""
        if not v:
            raise ValueError("Keys dictionary cannot be empty")
        return v

    @field_serializer("created_date", "rotation_date", "last_cleanup", when_used="json")
    def serialize_datetime(self, value: Optional[datetime]) -> Optional[str]:
        """Serialize datetime fields to ISO format."""
        return value.isoformat() if value else None

    def get_current_key(self) -> str:
        """
        Get the current active key.

        Returns:
            Encoded current key

        Raises:
            ValueError: If current version key is not found
        """
        current_key = self.keys.get(str(self.current_version))
        if not current_key:
            raise ValueError(f"Current key version {self.current_version} not found")
        return current_key

    def get_key_by_version(self, version: int) -> Optional[str]:
        """
        Get key by specific version.

        Args:
            version: Key version to retrieve

        Returns:
            Encoded key if found, None otherwise
        """
        return self.keys.get(str(version))

    def add_new_key_version(self, encoded_key: str, rotated_by: str = "key_rotation_manager") -> int:
        """
        Add a new key version and make it current.

        Args:
            encoded_key: New encoded key to add
            rotated_by: Entity performing the rotation

        Returns:
            New version number
        """
        new_version = self.current_version + 1
        self.keys[str(new_version)] = encoded_key
        self.current_version = new_version
        self.rotation_date = datetime.now(timezone.utc)
        self.rotated_by = rotated_by

        return new_version

    def cleanup_old_versions(self, keep_versions: int = 3) -> List[str]:
        """
        Remove old key versions, keeping only the most recent ones.

        Args:
            keep_versions: Number of recent versions to keep

        Returns:
            List of removed version numbers
        """
        if keep_versions < 1:
            raise ValueError("Must keep at least 1 version")

        # Determine which versions to keep (most recent)
        versions_to_keep = []
        for i in range(keep_versions):
            version = self.current_version - i
            if version > 0 and str(version) in self.keys:
                versions_to_keep.append(str(version))

        # Identify versions to remove
        removed_versions = [v for v in self.keys.keys() if v not in versions_to_keep]

        # Remove old versions
        for version in removed_versions:
            del self.keys[version]

        # Update cleanup timestamp
        if removed_versions:
            self.last_cleanup = datetime.now(timezone.utc)

        return removed_versions

    def get_available_versions(self) -> List[int]:
        """
        Get list of available key versions.

        Returns:
            Sorted list of available version numbers
        """
        return sorted([int(v) for v in self.keys.keys()])

    def get_total_versions(self) -> int:
        """
        Get total number of key versions.

        Returns:
            Number of available versions
        """
        return len(self.keys)

    def to_secrets_manager_format(self) -> str:
        """
        Convert to JSON format for AWS Secrets Manager storage.

        Returns:
            JSON string representation
        """
        return self.model_dump_json()

    @classmethod
    def from_secrets_manager_format(cls, json_str: str) -> "VersionedKeyData":
        """
        Create instance from AWS Secrets Manager JSON format.

        Args:
            json_str: JSON string from Secrets Manager

        Returns:
            VersionedKeyData instance
        """
        return cls.model_validate_json(json_str)

    @classmethod
    def create_initial(
        cls, encoded_key: str, key_type: KeyType, created_by: str = "key_rotation_manager"
    ) -> "VersionedKeyData":
        """
        Create initial versioned key data with first key.

        Args:
            encoded_key: Initial encoded key
            key_type: Type of key being created
            created_by: Entity creating the initial key

        Returns:
            New VersionedKeyData instance
        """
        return cls(current_version=1, keys={"1": encoded_key}, key_type=key_type, created_by=created_by)


class KeyRotationResult(BaseModel):
    """Result of a key rotation operation."""

    success: bool
    previous_version: int
    new_version: int
    rotation_date: datetime
    total_versions: int
    message: Optional[str] = None


class KeyCleanupResult(BaseModel):
    """Result of a key cleanup operation."""

    success: bool
    removed_versions: List[str]
    kept_versions: List[str]
    message: str


class KeyStatusResult(BaseModel):
    """Status information about key versions."""

    success: bool
    current_version: Optional[int] = None
    total_versions: Optional[int] = None
    available_versions: Optional[List[int]] = None
    key_type: Optional[KeyType] = None
    last_rotation: Optional[datetime] = None
    last_cleanup: Optional[datetime] = None
    error: Optional[str] = None
