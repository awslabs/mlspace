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
Cookie utilities for BFF authentication.

Provides utilities for creating secure HTTP cookies for session management
and state parameter handling using Python's standard http.cookies library.
"""

from http.cookies import SimpleCookie
from typing import Dict, Optional


def create_session_cookie(
    session_id: str,
    max_age_seconds: int = 86400,
    domain: Optional[str] = None,
    secure: bool = True,
    same_site: str = "None",
    path: str = "/",
) -> str:
    """
    Create a secure session cookie.

    Args:
        session_id: Session identifier
        max_age_seconds: Cookie lifetime in seconds (default 24 hours)
        domain: Cookie domain (optional)
        secure: Whether to set Secure flag (default True)
        same_site: SameSite attribute value (default "Strict")
        path: Cookie path (default "/", should be "/{stage}" for stage-based deployments)

    Returns:
        Set-Cookie header value
    """
    cookie = SimpleCookie()
    cookie["mlspace_session"] = session_id
    cookie["mlspace_session"]["httponly"] = True
    cookie["mlspace_session"]["max-age"] = max_age_seconds
    cookie["mlspace_session"]["path"] = path
    cookie["mlspace_session"]["samesite"] = same_site

    if secure:
        cookie["mlspace_session"]["secure"] = True

    if domain:
        cookie["mlspace_session"]["domain"] = domain

    return cookie.output(header="").strip()


def create_state_cookie(
    nonce: str, max_age_seconds: int = 600, secure: bool = True, same_site: str = "Strict", path: str = "/auth"
) -> str:
    """
    Create a state cookie for CSRF protection.

    Args:
        nonce: Nonce value for state validation
        max_age_seconds: Cookie lifetime in seconds (default 10 minutes)
        secure: Whether to set Secure flag (default True)
        same_site: SameSite attribute value (default "Strict")
        path: Cookie path (default "/auth", should include stage if not using custom domain)

    Returns:
        Set-Cookie header value
    """
    cookie = SimpleCookie()
    cookie["mlspace_auth_state"] = nonce
    cookie["mlspace_auth_state"]["httponly"] = True
    cookie["mlspace_auth_state"]["max-age"] = max_age_seconds
    cookie["mlspace_auth_state"]["path"] = path
    cookie["mlspace_auth_state"]["samesite"] = same_site

    if secure:
        cookie["mlspace_auth_state"]["secure"] = True

    return cookie.output(header="").strip()


def clear_session_cookie(domain: Optional[str] = None, path: str = "/") -> str:
    """
    Create a cookie header to clear the session cookie.

    Args:
        domain: Cookie domain (optional)
        path: Cookie path (default "/", should match the path used when creating the cookie)

    Returns:
        Set-Cookie header value to clear the session cookie
    """
    cookie = SimpleCookie()
    cookie["mlspace_session"] = ""
    cookie["mlspace_session"]["httponly"] = True
    cookie["mlspace_session"]["max-age"] = 0
    cookie["mlspace_session"]["path"] = path
    cookie["mlspace_session"]["samesite"] = "Strict"
    cookie["mlspace_session"]["secure"] = True

    if domain:
        cookie["mlspace_session"]["domain"] = domain

    return cookie.output(header="").strip()


def clear_state_cookie(path: str = "/auth") -> str:
    """
    Create a cookie header to clear the state cookie.

    Args:
        path: Cookie path (default "/auth", should include stage if not using custom domain)

    Returns:
        Set-Cookie header value to clear the state cookie
    """
    cookie = SimpleCookie()
    cookie["mlspace_auth_state"] = ""
    cookie["mlspace_auth_state"]["httponly"] = True
    cookie["mlspace_auth_state"]["max-age"] = 0
    cookie["mlspace_auth_state"]["path"] = path
    cookie["mlspace_auth_state"]["samesite"] = "Strict"
    cookie["mlspace_auth_state"]["secure"] = True

    return cookie.output(header="").strip()


def parse_cookies(cookie_header: Optional[str]) -> Dict[str, str]:
    """
    Parse cookies from Cookie header.

    Args:
        cookie_header: Cookie header value

    Returns:
        Dictionary of cookie name-value pairs
    """
    if not cookie_header:
        return {}

    cookie = SimpleCookie()
    cookie.load(cookie_header)

    # Extract just the values, not the Morsel objects
    return {name: morsel.value for name, morsel in cookie.items()}


def get_cookie_value(cookie_header: Optional[str], cookie_name: str) -> Optional[str]:
    """
    Extract a specific cookie value from Cookie header.

    Args:
        cookie_header: Cookie header value
        cookie_name: Name of the cookie to extract

    Returns:
        Cookie value if found, None otherwise
    """
    cookies = parse_cookies(cookie_header)
    return cookies.get(cookie_name)


def create_redirect_response(location: str, cookies: Optional[list] = None, status_code: int = 302) -> Dict:
    """
    Create a redirect response with optional cookies.

    Args:
        location: Redirect URL
        cookies: List of Set-Cookie header values
        status_code: HTTP status code (default 302)

    Returns:
        Lambda response dictionary
    """
    headers = {
        "Location": location,
        "Cache-Control": "no-store, no-cache",
        "Pragma": "no-cache",
        # CORS headers for localhost development
        "Access-Control-Allow-Origin": "http://localhost:3000",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    }

    # Add security headers
    security_headers = get_security_headers()
    headers.update(security_headers)

    response = {"statusCode": status_code, "headers": headers}

    # Add cookies if provided
    if cookies:
        # Use multiValueHeaders for multiple Set-Cookie headers
        response["multiValueHeaders"] = {"Set-Cookie": cookies}

    return response


def create_json_response(body: dict, status_code: int = 200, cookies: Optional[list] = None) -> Dict:
    """
    Create a JSON response with optional cookies.

    Args:
        body: Response body dictionary
        status_code: HTTP status code (default 200)
        cookies: List of Set-Cookie header values

    Returns:
        Lambda response dictionary
    """
    import json

    headers = {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache",
        "Pragma": "no-cache",
        # CORS headers for localhost development
        "Access-Control-Allow-Origin": "http://localhost:3000",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    }

    # Add security headers
    security_headers = get_security_headers()
    headers.update(security_headers)

    response = {"statusCode": status_code, "headers": headers, "body": json.dumps(body, default=str)}

    # Add cookies if provided
    if cookies:
        response["multiValueHeaders"] = {"Set-Cookie": cookies}

    return response


def get_security_headers() -> Dict[str, str]:
    """
    Get standard security headers for all authentication responses.

    Returns:
        Dictionary of security headers
    """
    return {
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Content-Security-Policy": "default-src 'self'; frame-ancestors 'none'",
        "Referrer-Policy": "strict-origin-when-cross-origin",
    }


def extract_domain_from_host(host_header: Optional[str]) -> Optional[str]:
    """
    Extract domain from Host header for cookie domain setting.

    Args:
        host_header: Host header value

    Returns:
        Domain for cookie, or None if invalid
    """
    if not host_header:
        return None

    # Remove port if present (except for localhost)
    domain = host_header.split(":")[0] if ":" in host_header and not host_header.startswith("localhost") else host_header

    # Basic validation
    if "." not in domain and not domain.startswith("localhost"):
        return None

    return domain.lower()


def should_set_secure_flag(host_header: Optional[str]) -> bool:
    """
    Determine if Secure flag should be set on cookies.

    Args:
        host_header: Host header value

    Returns:
        True for SameSite=None (required by browsers)
    """
    # SameSite=None REQUIRES Secure=true (browser requirement)
    return True
