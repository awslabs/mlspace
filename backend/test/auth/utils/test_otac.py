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

from ml_space_lambda.auth.utils.otac import (
    build_domain_list,
    build_sync_chain_url,
    extract_domain_from_url,
    generate_otac,
    normalize_domain,
    parse_sync_request,
    should_initiate_sync,
    validate_otac_format,
)


class TestOTACUtilities:
    """Test OTAC utility functions."""

    def test_generate_otac(self):
        """Test OTAC generation."""
        otac = generate_otac()

        assert otac.startswith("otac:")
        assert len(otac) > 5  # Should have content after prefix

        # Generate multiple OTACs to ensure uniqueness
        otac2 = generate_otac()
        assert otac != otac2

    def test_validate_otac_format(self):
        """Test OTAC format validation."""
        valid_otac = "otac:abc123xyz"
        invalid_otacs = ["", "invalid", "otac:", "session:123", "otac", None]

        assert validate_otac_format(valid_otac) is True

        for invalid in invalid_otacs:
            assert validate_otac_format(invalid) is False

    def test_build_sync_chain_url(self):
        """Test building sync chain URL."""
        current_domain = "app.example.com"
        otac = "otac:test123"
        remaining_domains = ["api.example.com", "notebooks.example.com"]
        final_url = "https://app.example.com/dashboard"

        url = build_sync_chain_url(current_domain, otac, remaining_domains, final_url)

        assert url.startswith("https://api.example.com/auth/sync")
        assert "otac=otac%3Atest123" in url  # URL encoded colon
        assert "next=notebooks.example.com" in url
        assert "final=https%3A%2F%2Fapp.example.com%2Fdashboard" in url  # URL encoded

    def test_build_sync_chain_url_end_of_chain(self):
        """Test building sync chain URL at end of chain."""
        current_domain = "notebooks.example.com"
        otac = "otac:test123"
        remaining_domains = []
        final_url = "https://app.example.com/dashboard"

        url = build_sync_chain_url(current_domain, otac, remaining_domains, final_url)

        assert url == final_url

    def test_parse_sync_request(self):
        """Test parsing sync request parameters."""
        query_params = {
            "otac": "otac:test123",
            "next": "api.example.com,notebooks.example.com",
            "final": "https://app.example.com/dashboard",
        }

        otac, remaining_domains, final_url = parse_sync_request(query_params)

        assert otac == "otac:test123"
        assert remaining_domains == ["api.example.com", "notebooks.example.com"]
        assert final_url == "https://app.example.com/dashboard"

    def test_parse_sync_request_no_next(self):
        """Test parsing sync request without next domains."""
        query_params = {"otac": "otac:test123", "final": "https://app.example.com/dashboard"}

        otac, remaining_domains, final_url = parse_sync_request(query_params)

        assert otac == "otac:test123"
        assert remaining_domains == []
        assert final_url == "https://app.example.com/dashboard"

    def test_normalize_domain(self):
        """Test domain normalization."""
        test_cases = [
            ("example.com", "example.com"),
            ("https://example.com", "example.com"),
            ("http://example.com", "example.com"),
            ("example.com:8080", "example.com"),
            ("localhost:3000", "localhost:3000"),  # Keep port for localhost
            ("example.com/path", "example.com"),
            ("EXAMPLE.COM", "example.com"),
            ("", ""),
        ]

        for input_domain, expected in test_cases:
            assert normalize_domain(input_domain) == expected

    def test_build_domain_list(self):
        """Test building domain list for sync."""
        primary_domain = "app.example.com"
        sync_domains_str = "api.example.com, notebooks.example.com, app.example.com"

        domains = build_domain_list(primary_domain, sync_domains_str)

        # Should exclude primary domain
        assert "app.example.com" not in domains
        assert "api.example.com" in domains
        assert "notebooks.example.com" in domains

    def test_build_domain_list_empty(self):
        """Test building domain list with empty input."""
        domains = build_domain_list("app.example.com", "")
        assert domains == []

        domains = build_domain_list("app.example.com", None)
        assert domains == []

    def test_should_initiate_sync(self):
        """Test determining if sync should be initiated."""
        assert should_initiate_sync(["api.example.com"]) is True
        assert should_initiate_sync([]) is False

    def test_extract_domain_from_url(self):
        """Test extracting domain from URL."""
        test_cases = [
            ("https://example.com/path", "example.com"),
            ("http://api.example.com:8080/auth", "api.example.com:8080"),
            ("https://sub.example.com", "sub.example.com"),
            ("invalid-url", ""),
            ("", ""),
        ]

        for url, expected in test_cases:
            assert extract_domain_from_url(url) == expected
