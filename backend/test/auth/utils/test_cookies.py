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

from ml_space_lambda.auth.utils.cookies import (
    clear_session_cookie,
    clear_state_cookie,
    create_session_cookie,
    create_state_cookie,
    extract_domain_from_host,
    get_cookie_value,
    parse_cookies,
    should_set_secure_flag,
)


class TestCookieUtilities:
    """Test cookie utility functions."""

    def test_create_session_cookie(self):
        """Test creating session cookie."""
        session_id = "session:12345"
        cookie = create_session_cookie(session_id)

        assert "mlspace_session=session:12345" in cookie
        assert "HttpOnly" in cookie
        assert "Max-Age=86400" in cookie
        assert "Path=/" in cookie
        assert "SameSite=Strict" in cookie
        assert "Secure" in cookie

    def test_create_session_cookie_with_domain(self):
        """Test creating session cookie with domain."""
        session_id = "session:12345"
        cookie = create_session_cookie(session_id, domain="example.com")

        assert "Domain=example.com" in cookie

    def test_create_state_cookie(self):
        """Test creating state cookie."""
        nonce = "test_nonce_12345"
        cookie = create_state_cookie(nonce)

        assert "mlspace_auth_state=test_nonce_12345" in cookie
        assert "HttpOnly" in cookie
        assert "Max-Age=600" in cookie
        assert "Path=/auth" in cookie
        assert "SameSite=Strict" in cookie
        assert "Secure" in cookie

    def test_clear_session_cookie(self):
        """Test clearing session cookie."""
        cookie = clear_session_cookie()

        assert "mlspace_session=" in cookie
        assert "Max-Age=0" in cookie

    def test_clear_state_cookie(self):
        """Test clearing state cookie."""
        cookie = clear_state_cookie()

        assert "mlspace_auth_state=" in cookie
        assert "Max-Age=0" in cookie

    def test_parse_cookies(self):
        """Test parsing cookie header."""
        cookie_header = "mlspace_session=session:123; other_cookie=value; third=test"
        cookies = parse_cookies(cookie_header)

        assert cookies["mlspace_session"] == "session:123"
        assert cookies["other_cookie"] == "value"
        assert cookies["third"] == "test"

    def test_parse_cookies_empty_header(self):
        """Test parsing empty cookie header."""
        cookies = parse_cookies(None)
        assert cookies == {}

        cookies = parse_cookies("")
        assert cookies == {}

    def test_get_cookie_value(self):
        """Test extracting specific cookie value."""
        cookie_header = "mlspace_session=session:123; other_cookie=value"

        session_id = get_cookie_value(cookie_header, "mlspace_session")
        assert session_id == "session:123"

        other_value = get_cookie_value(cookie_header, "other_cookie")
        assert other_value == "value"

        missing_value = get_cookie_value(cookie_header, "missing")
        assert missing_value is None

    def test_extract_domain_from_host(self):
        """Test extracting domain from host header."""
        assert extract_domain_from_host("example.com") == "example.com"
        assert extract_domain_from_host("example.com:8080") == "example.com"
        assert extract_domain_from_host("localhost:3000") == "localhost:3000"
        assert extract_domain_from_host("sub.example.com") == "sub.example.com"
        assert extract_domain_from_host("invalid") is None
        assert extract_domain_from_host(None) is None

    def test_should_set_secure_flag(self):
        """Test determining if Secure flag should be set."""
        assert should_set_secure_flag("example.com") is True
        assert should_set_secure_flag("localhost:3000") is False
        assert should_set_secure_flag("LOCALHOST:8080") is False
        assert should_set_secure_flag(None) is True
