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
Session management utilities for BFF authentication.

Handles CRUD operations for user sessions stored in DynamoDB.
"""

import time
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

from ml_space_lambda.auth.session.encryption import TokenEncryption
from ml_space_lambda.data_access_objects.dynamo_data_store import DynamoDBObjectStore


class SessionManager:
    """
    Manages user authentication sessions in DynamoDB.

    Handles creation, retrieval, update, and deletion of session records
    with encrypted token storage.
    """

    def __init__(self, table_name: str, encryption: TokenEncryption, client=None):
        """
        Initialize session manager.

        Args:
            table_name: DynamoDB table name for session storage
            encryption: Token encryption instance
            client: Optional DynamoDB client (for testing)
        """
        self.store = DynamoDBObjectStore(table_name, client)
        self.encryption = encryption

    def create_session(
        self,
        user_data: Dict,
        tokens: Dict[str, str],
        provider: str,
        expires_at: datetime,
        refresh_at: datetime,
        login_domain: str,
        synced_domains: Optional[List[str]] = None,
        raw_idp_response: Optional[str] = None,
    ) -> str:
        """
        Create a new user session.

        Args:
            user_data: User identity information (id, displayName, email, groups, attributes)
            tokens: IdP tokens (access_token, refresh_token, id_token)
            provider: Identity provider type (e.g., 'oidc')
            expires_at: Session expiration timestamp
            refresh_at: Token refresh threshold timestamp
            login_domain: Domain where login was initiated
            synced_domains: List of domains where session cookies were set
            raw_idp_response: Base64 encoded raw IdP response for debugging

        Returns:
            Session ID

        Raises:
            Exception: If session creation fails
        """
        session_id = f"session:{uuid.uuid4()}"

        # Encrypt sensitive tokens
        encrypted_tokens = {}
        for token_type, token_value in tokens.items():
            if token_value:  # Only encrypt non-empty tokens
                encrypted_tokens[token_type] = self.encryption.encrypt_token(token_value)

        # Calculate TTL (session expiration + 1 hour buffer for cleanup)
        ttl = int(expires_at.timestamp()) + 3600

        session_record = {
            "pk": session_id,
            "ttl": ttl,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "data": {
                "user": user_data,
                "session": {
                    "provider": provider,
                    "expiresAt": expires_at.isoformat(),
                    "refreshAt": refresh_at.isoformat(),
                    **encrypted_tokens,
                },
                "metadata": {"loginDomain": login_domain, "syncedDomains": synced_domains or []},
            },
        }

        # Add raw IdP response if provided
        if raw_idp_response:
            session_record["raw_data"] = raw_idp_response

        try:
            # Create session with condition to prevent overwrites
            self.store._create(session_record, condition_expression="attribute_not_exists(pk)")
            return session_id
        except Exception as e:
            raise Exception(f"Failed to create session: {e}")

    def get_session(self, session_id: str) -> Optional[Dict]:
        """
        Retrieve session data by session ID.

        Args:
            session_id: Session identifier

        Returns:
            Session data with decrypted tokens, or None if not found/expired
        """
        if not session_id or not session_id.startswith("session:"):
            return None

        try:
            session_record = self.store._retrieve({"pk": session_id})

            # Check TTL expiration
            if session_record.get("ttl", 0) < int(time.time()):
                return None

            # Check session expiration
            session_data = session_record.get("data", {}).get("session", {})
            expires_at = datetime.fromisoformat(session_data.get("expiresAt", ""))
            if expires_at < datetime.now(timezone.utc):
                return None

            # Decrypt tokens
            decrypted_session = self._decrypt_session_tokens(session_record)
            return decrypted_session

        except Exception:
            # Session not found or other error
            return None

    def update_session_tokens(
        self, session_id: str, tokens: Dict[str, str], expires_at: datetime, refresh_at: datetime
    ) -> bool:
        """
        Update session tokens after refresh (tokens only, no user data).

        Args:
            session_id: Session identifier
            tokens: New IdP tokens
            expires_at: New session expiration timestamp
            refresh_at: New token refresh threshold timestamp

        Returns:
            True if update successful, False otherwise
        """
        return self.update_session(session_id=session_id, tokens=tokens, expires_at=expires_at, refresh_at=refresh_at)

    def update_session(
        self,
        session_id: str,
        tokens: Optional[Dict[str, str]] = None,
        user_data: Optional[Dict] = None,
        expires_at: Optional[datetime] = None,
        refresh_at: Optional[datetime] = None,
        raw_idp_response: Optional[str] = None,
    ) -> bool:
        """
        Update session with tokens and/or user data.

        This method handles both token refresh and user profile updates
        that might occur when refreshing tokens or re-validating sessions.

        Args:
            session_id: Session identifier
            tokens: New IdP tokens (optional)
            user_data: Updated user information (optional)
            expires_at: New session expiration timestamp (optional)
            refresh_at: New token refresh threshold timestamp (optional)
            raw_idp_response: Updated raw IdP response for debugging (optional)

        Returns:
            True if update successful, False otherwise
        """
        if not session_id or not session_id.startswith("session:"):
            return False

        try:
            # Build update expression dynamically
            update_parts = []
            expression_values = {}
            expression_names = {"#data": "data", "#session": "session", "#user": "user"}

            # Always update the timestamp
            update_parts.append("updated_at = :updated_at")
            expression_values[":updated_at"] = datetime.now(timezone.utc).isoformat()

            # Update tokens if provided
            if tokens:
                encrypted_tokens = {}
                for token_type, token_value in tokens.items():
                    if token_value:
                        encrypted_tokens[token_type] = self.encryption.encrypt_token(token_value)

                for token_type, encrypted_token in encrypted_tokens.items():
                    update_parts.append(f"#data.#session.{token_type} = :{token_type}")
                    expression_values[f":{token_type}"] = encrypted_token

            # Update timestamps if provided
            if expires_at:
                update_parts.append("#data.#session.expiresAt = :expires_at")
                expression_values[":expires_at"] = expires_at.isoformat()

                # Update TTL when expiration changes
                new_ttl = int(expires_at.timestamp()) + 3600
                update_parts.append("ttl = :ttl")
                expression_values[":ttl"] = new_ttl

            if refresh_at:
                update_parts.append("#data.#session.refreshAt = :refresh_at")
                expression_values[":refresh_at"] = refresh_at.isoformat()

            # Update user data if provided
            if user_data:
                # Update individual user fields to preserve existing data
                if "id" in user_data:
                    update_parts.append("#data.#user.id = :user_id")
                    expression_values[":user_id"] = user_data["id"]

                if "displayName" in user_data:
                    update_parts.append("#data.#user.displayName = :display_name")
                    expression_values[":display_name"] = user_data["displayName"]

                if "email" in user_data:
                    update_parts.append("#data.#user.email = :email")
                    expression_values[":email"] = user_data["email"]

                if "groups" in user_data:
                    update_parts.append("#data.#user.groups = :groups")
                    expression_values[":groups"] = user_data["groups"]

                if "attributes" in user_data:
                    update_parts.append("#data.#user.attributes = :attributes")
                    expression_values[":attributes"] = user_data["attributes"]

            # Update raw IdP response if provided
            if raw_idp_response:
                update_parts.append("raw_data = :raw_data")
                expression_values[":raw_data"] = raw_idp_response

            if not update_parts:
                # Nothing to update besides timestamp
                return True

            update_expression = "SET " + ", ".join(update_parts)

            self.store._update(
                {"pk": session_id},
                update_expression,
                condition_expression="attribute_exists(pk)",
                expression_names=expression_names,
                expression_values=expression_values,
            )
            return True

        except Exception:
            return False

    def refresh_session_with_user_data(
        self,
        session_id: str,
        tokens: Dict[str, str],
        user_data: Dict,
        expires_at: datetime,
        refresh_at: datetime,
        raw_idp_response: Optional[str] = None,
    ) -> bool:
        """
        Refresh session tokens and update user data in one operation.

        This is the recommended method to use when refreshing tokens,
        as it ensures both tokens and user profile are kept up-to-date.

        Args:
            session_id: Session identifier
            tokens: New IdP tokens
            user_data: Updated user information from IdP
            expires_at: New session expiration timestamp
            refresh_at: New token refresh threshold timestamp
            raw_idp_response: Updated raw IdP response for debugging

        Returns:
            True if update successful, False otherwise
        """
        return self.update_session(
            session_id=session_id,
            tokens=tokens,
            user_data=user_data,
            expires_at=expires_at,
            refresh_at=refresh_at,
            raw_idp_response=raw_idp_response,
        )

    def delete_session(self, session_id: str) -> bool:
        """
        Delete a session.

        Args:
            session_id: Session identifier

        Returns:
            True if deletion successful, False otherwise
        """
        if not session_id or not session_id.startswith("session:"):
            return False

        try:
            self.store._delete({"pk": session_id})
            return True
        except Exception:
            return False

    def add_synced_domain(self, session_id: str, domain: str) -> bool:
        """
        Add a domain to the list of synced domains for cross-domain cookie sync.

        Args:
            session_id: Session identifier
            domain: Domain to add to synced list

        Returns:
            True if update successful, False otherwise
        """
        if not session_id or not session_id.startswith("session:"):
            return False

        try:
            self.store._update(
                {"pk": session_id},
                "ADD #data.metadata.syncedDomains :domain SET updated_at = :updated_at",
                condition_expression="attribute_exists(pk)",
                expression_names={"#data": "data"},
                expression_values={
                    ":domain": {domain},  # DynamoDB set type
                    ":updated_at": datetime.now(timezone.utc).isoformat(),
                },
            )
            return True
        except Exception:
            return False

    def _decrypt_session_tokens(self, session_record: Dict) -> Dict:
        """
        Decrypt tokens in session record.

        Args:
            session_record: Raw session record from DynamoDB

        Returns:
            Session record with decrypted tokens
        """
        decrypted_record = session_record.copy()
        session_data = decrypted_record.get("data", {}).get("session", {})

        # Decrypt each token field
        token_fields = ["access_token", "refresh_token", "id_token"]
        for field in token_fields:
            if field in session_data and session_data[field]:
                try:
                    if self.encryption.is_encrypted_token(session_data[field]):
                        session_data[field] = self.encryption.decrypt_token(session_data[field])
                except Exception:
                    # If decryption fails, remove the token
                    session_data[field] = None

        return decrypted_record


class OTACManager:
    """
    Manages One-Time Authentication Codes (OTAC) for cross-domain cookie synchronization.
    """

    def __init__(self, table_name: str, client=None):
        """
        Initialize OTAC manager.

        Args:
            table_name: DynamoDB table name (same as sessions)
            client: Optional DynamoDB client (for testing)
        """
        self.store = DynamoDBObjectStore(table_name, client)

    def create_otac(self, session_id: str, remaining_domains: List[str], final_redirect_url: str) -> str:
        """
        Create a new OTAC for cross-domain synchronization.

        Args:
            session_id: Associated session ID
            remaining_domains: List of domains still to be synced
            final_redirect_url: Final URL to redirect to after sync chain

        Returns:
            OTAC identifier

        Raises:
            Exception: If OTAC creation fails
        """
        otac_id = f"otac:{uuid.uuid4()}"

        # OTAC expires in 5 minutes
        ttl = int(time.time()) + 300

        otac_record = {
            "pk": otac_id,
            "ttl": ttl,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "data": {
                "sessionId": session_id,
                "remainingDomains": remaining_domains,
                "finalRedirectUrl": final_redirect_url,
                "usedAt": None,
            },
        }

        try:
            self.store._create(otac_record, condition_expression="attribute_not_exists(pk)")
            return otac_id
        except Exception as e:
            raise Exception(f"Failed to create OTAC: {e}")

    def validate_and_consume_otac(self, otac_id: str) -> Optional[Dict]:
        """
        Validate OTAC and mark it as used (single-use).

        Args:
            otac_id: OTAC identifier

        Returns:
            OTAC data if valid and unused, None otherwise
        """
        if not otac_id or not otac_id.startswith("otac:"):
            return None

        try:
            # Strong consistent read for security
            otac_record = self.store.client.get_item(
                TableName=self.store.table_name, Key={"pk": {"S": otac_id}}, ConsistentRead=True
            )

            if "Item" not in otac_record:
                return None

            # Convert DynamoDB format to dict
            from dynamodb_json import json_util as dynamodb_json

            otac_data = dynamodb_json.loads(otac_record["Item"])

            # Check TTL
            if otac_data.get("ttl", 0) < int(time.time()):
                return None

            # Check if already used
            if otac_data.get("data", {}).get("usedAt"):
                return None

            # Mark as used with conditional update
            try:
                self.store._update(
                    {"pk": otac_id},
                    "SET #data.usedAt = :timestamp",
                    condition_expression="attribute_not_exists(#data.usedAt)",
                    expression_names={"#data": "data"},
                    expression_values={":timestamp": datetime.now(timezone.utc).isoformat()},
                )
            except Exception:
                # OTAC was already used (race condition)
                return None

            return otac_data.get("data", {})

        except Exception:
            return None
