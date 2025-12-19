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
Session validation logic for BFF authentication.

Validates session cookies and determines if sessions need refresh.
"""

from datetime import datetime, timezone
from typing import Dict, Optional, Tuple


class SessionValidator:
    """
    Validates user sessions and determines refresh requirements.
    """

    @staticmethod
    def validate_session_data(session_data: Optional[Dict]) -> Tuple[bool, Optional[str]]:
        """
        Validate session data structure and expiration.

        Args:
            session_data: Session data from DynamoDB

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not session_data:
            return False, "Session not found"

        # Check required fields
        if "data" not in session_data:
            return False, "Invalid session structure"

        data = session_data["data"]

        if "user" not in data or "session" not in data:
            return False, "Missing required session fields"

        # Validate user data
        user = data["user"]
        required_user_fields = ["id", "displayName", "email"]
        for field in required_user_fields:
            if field not in user:
                return False, f"Missing required user field: {field}"

        # Validate session data
        session = data["session"]
        required_session_fields = ["provider", "expiresAt", "refreshAt"]
        for field in required_session_fields:
            if field not in session:
                return False, f"Missing required session field: {field}"

        # Check expiration
        try:
            expires_at = datetime.fromisoformat(session["expiresAt"])
            if expires_at < datetime.now(timezone.utc):
                return False, "Session expired"
        except (ValueError, TypeError):
            return False, "Invalid expiration timestamp"

        return True, None

    @staticmethod
    def should_refresh_session(session_data: Dict, threshold_seconds: int = 300) -> bool:
        """
        Determine if session tokens should be refreshed.

        Args:
            session_data: Session data from DynamoDB
            threshold_seconds: Seconds before refreshAt to trigger refresh (default 5 minutes)

        Returns:
            True if session should be refreshed, False otherwise
        """
        if not session_data or "data" not in session_data:
            return False

        session = session_data["data"].get("session", {})
        refresh_at_str = session.get("refreshAt")

        if not refresh_at_str:
            return False

        try:
            refresh_at = datetime.fromisoformat(refresh_at_str)
            now = datetime.now(timezone.utc)

            # Check if we're within threshold of refresh time
            time_until_refresh = (refresh_at - now).total_seconds()
            return time_until_refresh <= threshold_seconds

        except (ValueError, TypeError):
            return False

    @staticmethod
    def is_session_expired(session_data: Dict) -> bool:
        """
        Check if session has expired.

        Args:
            session_data: Session data from DynamoDB

        Returns:
            True if session is expired, False otherwise
        """
        if not session_data or "data" not in session_data:
            return True

        session = session_data["data"].get("session", {})
        expires_at_str = session.get("expiresAt")

        if not expires_at_str:
            return True

        try:
            expires_at = datetime.fromisoformat(expires_at_str)
            return expires_at < datetime.now(timezone.utc)
        except (ValueError, TypeError):
            return True

    @staticmethod
    def get_session_info(session_data: Dict) -> Dict:
        """
        Extract session information for API responses.

        Args:
            session_data: Session data from DynamoDB

        Returns:
            Dictionary with user and session information
        """
        if not session_data or "data" not in session_data:
            return {}

        data = session_data["data"]
        user = data.get("user", {})
        session = data.get("session", {})

        return {
            "user": {
                "id": user.get("id"),
                "displayName": user.get("displayName"),
                "email": user.get("email"),
                "groups": user.get("groups", []),
                "attributes": user.get("attributes", {}),
            },
            "session": {
                "expiresAt": session.get("expiresAt"),
                "refreshAt": session.get("refreshAt"),
                "provider": session.get("provider"),
            },
        }

    @staticmethod
    def extract_session_id_from_cookie(cookie_header: Optional[str], cookie_name: str = "mlspace_session") -> Optional[str]:
        """
        Extract session ID from Cookie header.

        Args:
            cookie_header: Cookie header value
            cookie_name: Name of the session cookie

        Returns:
            Session ID if found, None otherwise
        """
        if not cookie_header:
            return None

        # Parse cookies
        cookies = {}
        for cookie in cookie_header.split(";"):
            cookie = cookie.strip()
            if "=" in cookie:
                name, value = cookie.split("=", 1)
                cookies[name.strip()] = value.strip()

        session_id = cookies.get(cookie_name)

        # Validate session ID format
        if session_id and session_id.startswith("session:"):
            return session_id

        return None

    @staticmethod
    def validate_domain(domain: str, allowed_domains: list) -> bool:
        """
        Validate that a domain is in the allowed list.

        Args:
            domain: Domain to validate
            allowed_domains: List of allowed domains

        Returns:
            True if domain is allowed, False otherwise
        """
        if not domain or not allowed_domains:
            return False

        # Normalize domain (remove protocol, port, path)
        normalized_domain = domain.lower().split(":")[0].split("/")[0]

        for allowed in allowed_domains:
            allowed_normalized = allowed.lower().split(":")[0].split("/")[0]
            if normalized_domain == allowed_normalized:
                return True

        return False
