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
Tests for session validator module.
"""

from datetime import datetime, timedelta, timezone

from ml_space_lambda.auth.session.validator import SessionValidator


class TestSessionValidator:
    """Tests for SessionValidator class."""

    def test_validate_session_data_valid(self):
        """Test validation of valid session data."""
        session_data = {
            "data": {
                "user": {
                    "id": "test-user",
                    "displayName": "Test User",
                    "email": "test@example.com",
                },
                "session": {
                    "provider": "oidc",
                    "expiresAt": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
                    "refreshAt": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
                },
            }
        }

        is_valid, error = SessionValidator.validate_session_data(session_data)
        assert is_valid is True
        assert error is None

    def test_validate_session_data_none(self):
        """Test validation with None session data."""
        is_valid, error = SessionValidator.validate_session_data(None)
        assert is_valid is False
        assert error == "Session not found"

    def test_validate_session_data_missing_data_field(self):
        """Test validation with missing data field."""
        session_data = {"other": "field"}
        is_valid, error = SessionValidator.validate_session_data(session_data)
        assert is_valid is False
        assert error == "Invalid session structure"

    def test_validate_session_data_missing_user(self):
        """Test validation with missing user field."""
        session_data = {
            "data": {
                "session": {
                    "provider": "oidc",
                    "expiresAt": datetime.now(timezone.utc).isoformat(),
                    "refreshAt": datetime.now(timezone.utc).isoformat(),
                }
            }
        }
        is_valid, error = SessionValidator.validate_session_data(session_data)
        assert is_valid is False
        assert error == "Missing required session fields"

    def test_validate_session_data_missing_session(self):
        """Test validation with missing session field."""
        session_data = {
            "data": {
                "user": {
                    "id": "test-user",
                    "displayName": "Test User",
                    "email": "test@example.com",
                }
            }
        }
        is_valid, error = SessionValidator.validate_session_data(session_data)
        assert is_valid is False
        assert error == "Missing required session fields"

    def test_validate_session_data_missing_user_id(self):
        """Test validation with missing user id."""
        session_data = {
            "data": {
                "user": {
                    "displayName": "Test User",
                    "email": "test@example.com",
                },
                "session": {
                    "provider": "oidc",
                    "expiresAt": datetime.now(timezone.utc).isoformat(),
                    "refreshAt": datetime.now(timezone.utc).isoformat(),
                },
            }
        }
        is_valid, error = SessionValidator.validate_session_data(session_data)
        assert is_valid is False
        assert "Missing required user field: id" in error

    def test_validate_session_data_missing_session_provider(self):
        """Test validation with missing session provider."""
        session_data = {
            "data": {
                "user": {
                    "id": "test-user",
                    "displayName": "Test User",
                    "email": "test@example.com",
                },
                "session": {
                    "expiresAt": datetime.now(timezone.utc).isoformat(),
                    "refreshAt": datetime.now(timezone.utc).isoformat(),
                },
            }
        }
        is_valid, error = SessionValidator.validate_session_data(session_data)
        assert is_valid is False
        assert "Missing required session field: provider" in error

    def test_validate_session_data_expired(self):
        """Test validation with expired session."""
        session_data = {
            "data": {
                "user": {
                    "id": "test-user",
                    "displayName": "Test User",
                    "email": "test@example.com",
                },
                "session": {
                    "provider": "oidc",
                    "expiresAt": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(),
                    "refreshAt": datetime.now(timezone.utc).isoformat(),
                },
            }
        }
        is_valid, error = SessionValidator.validate_session_data(session_data)
        assert is_valid is False
        assert error == "Session expired"

    def test_validate_session_data_invalid_expiration_format(self):
        """Test validation with invalid expiration timestamp."""
        session_data = {
            "data": {
                "user": {
                    "id": "test-user",
                    "displayName": "Test User",
                    "email": "test@example.com",
                },
                "session": {
                    "provider": "oidc",
                    "expiresAt": "invalid-timestamp",
                    "refreshAt": datetime.now(timezone.utc).isoformat(),
                },
            }
        }
        is_valid, error = SessionValidator.validate_session_data(session_data)
        assert is_valid is False
        assert error == "Invalid expiration timestamp"

    def test_should_refresh_session_true(self):
        """Test should_refresh_session returns True when within threshold."""
        session_data = {
            "data": {
                "session": {
                    "refreshAt": (datetime.now(timezone.utc) + timedelta(seconds=200)).isoformat(),
                }
            }
        }
        should_refresh = SessionValidator.should_refresh_session(session_data, threshold_seconds=300)
        assert should_refresh is True

    def test_should_refresh_session_false(self):
        """Test should_refresh_session returns False when outside threshold."""
        session_data = {
            "data": {
                "session": {
                    "refreshAt": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
                }
            }
        }
        should_refresh = SessionValidator.should_refresh_session(session_data, threshold_seconds=300)
        assert should_refresh is False

    def test_should_refresh_session_none_data(self):
        """Test should_refresh_session with None data."""
        should_refresh = SessionValidator.should_refresh_session(None)
        assert should_refresh is False

    def test_should_refresh_session_missing_refresh_at(self):
        """Test should_refresh_session with missing refreshAt."""
        session_data = {"data": {"session": {}}}
        should_refresh = SessionValidator.should_refresh_session(session_data)
        assert should_refresh is False

    def test_should_refresh_session_invalid_timestamp(self):
        """Test should_refresh_session with invalid timestamp."""
        session_data = {
            "data": {
                "session": {
                    "refreshAt": "invalid-timestamp",
                }
            }
        }
        should_refresh = SessionValidator.should_refresh_session(session_data)
        assert should_refresh is False

    def test_is_session_expired_true(self):
        """Test is_session_expired returns True for expired session."""
        session_data = {
            "data": {
                "session": {
                    "expiresAt": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(),
                }
            }
        }
        is_expired = SessionValidator.is_session_expired(session_data)
        assert is_expired is True

    def test_is_session_expired_false(self):
        """Test is_session_expired returns False for valid session."""
        session_data = {
            "data": {
                "session": {
                    "expiresAt": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
                }
            }
        }
        is_expired = SessionValidator.is_session_expired(session_data)
        assert is_expired is False

    def test_is_session_expired_none_data(self):
        """Test is_session_expired with None data."""
        is_expired = SessionValidator.is_session_expired(None)
        assert is_expired is True

    def test_is_session_expired_missing_expires_at(self):
        """Test is_session_expired with missing expiresAt."""
        session_data = {"data": {"session": {}}}
        is_expired = SessionValidator.is_session_expired(session_data)
        assert is_expired is True

    def test_is_session_expired_invalid_timestamp(self):
        """Test is_session_expired with invalid timestamp."""
        session_data = {
            "data": {
                "session": {
                    "expiresAt": "invalid-timestamp",
                }
            }
        }
        is_expired = SessionValidator.is_session_expired(session_data)
        assert is_expired is True

    def test_get_session_info_valid(self):
        """Test get_session_info with valid data."""
        session_data = {
            "data": {
                "user": {
                    "id": "test-user",
                    "displayName": "Test User",
                    "email": "test@example.com",
                    "groups": ["group1", "group2"],
                    "attributes": {"key": "value"},
                },
                "session": {
                    "provider": "oidc",
                    "expiresAt": "2024-01-01T00:00:00Z",
                    "refreshAt": "2024-01-01T00:00:00Z",
                },
            }
        }
        info = SessionValidator.get_session_info(session_data)
        assert info["user"]["id"] == "test-user"
        assert info["user"]["displayName"] == "Test User"
        assert info["user"]["email"] == "test@example.com"
        assert info["user"]["groups"] == ["group1", "group2"]
        assert info["user"]["attributes"] == {"key": "value"}
        assert info["session"]["provider"] == "oidc"

    def test_get_session_info_none_data(self):
        """Test get_session_info with None data."""
        info = SessionValidator.get_session_info(None)
        assert info == {}

    def test_get_session_info_missing_fields(self):
        """Test get_session_info with missing optional fields."""
        session_data = {
            "data": {
                "user": {
                    "id": "test-user",
                    "displayName": "Test User",
                    "email": "test@example.com",
                },
                "session": {
                    "provider": "oidc",
                },
            }
        }
        info = SessionValidator.get_session_info(session_data)
        assert info["user"]["groups"] == []
        assert info["user"]["attributes"] == {}

    def test_extract_session_id_from_cookie_valid(self):
        """Test extracting session ID from valid cookie."""
        cookie_header = "mlspace_session=session:abc123; other=value"
        session_id = SessionValidator.extract_session_id_from_cookie(cookie_header)
        assert session_id == "session:abc123"

    def test_extract_session_id_from_cookie_none_header(self):
        """Test extracting session ID from None header."""
        session_id = SessionValidator.extract_session_id_from_cookie(None)
        assert session_id is None

    def test_extract_session_id_from_cookie_missing(self):
        """Test extracting session ID when cookie is missing."""
        cookie_header = "other=value; another=cookie"
        session_id = SessionValidator.extract_session_id_from_cookie(cookie_header)
        assert session_id is None

    def test_extract_session_id_from_cookie_invalid_format(self):
        """Test extracting session ID with invalid format."""
        cookie_header = "mlspace_session=invalid-format"
        session_id = SessionValidator.extract_session_id_from_cookie(cookie_header)
        assert session_id is None

    def test_extract_session_id_from_cookie_custom_name(self):
        """Test extracting session ID with custom cookie name."""
        cookie_header = "custom_session=session:xyz789"
        session_id = SessionValidator.extract_session_id_from_cookie(cookie_header, cookie_name="custom_session")
        assert session_id == "session:xyz789"

    def test_validate_domain_valid(self):
        """Test domain validation with valid domain."""
        is_valid = SessionValidator.validate_domain("example.com", ["example.com", "test.com"])
        assert is_valid is True

    def test_validate_domain_invalid(self):
        """Test domain validation with invalid domain."""
        is_valid = SessionValidator.validate_domain("invalid.com", ["example.com", "test.com"])
        assert is_valid is False

    def test_validate_domain_none_domain(self):
        """Test domain validation with None domain."""
        is_valid = SessionValidator.validate_domain(None, ["example.com"])
        assert is_valid is False

    def test_validate_domain_none_allowed(self):
        """Test domain validation with None allowed list."""
        is_valid = SessionValidator.validate_domain("example.com", None)
        assert is_valid is False

    def test_validate_domain_with_port(self):
        """Test domain validation with port in domain."""
        is_valid = SessionValidator.validate_domain("example.com:8080", ["example.com"])
        assert is_valid is True

    def test_validate_domain_with_path(self):
        """Test domain validation with path in domain."""
        is_valid = SessionValidator.validate_domain("example.com/path", ["example.com"])
        assert is_valid is True

    def test_validate_domain_case_insensitive(self):
        """Test domain validation is case insensitive."""
        is_valid = SessionValidator.validate_domain("Example.COM", ["example.com"])
        assert is_valid is True
