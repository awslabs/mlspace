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
One-Time Authentication Code (OTAC) utilities for cross-domain cookie synchronization.

Provides utilities for generating secure OTACs and building synchronization chains
for multi-domain deployments.
"""

import secrets
from typing import List, Optional, Tuple
from urllib.parse import urlencode, urlparse


def generate_otac() -> str:
    """
    Generate a cryptographically secure one-time authentication code.

    Returns:
        OTAC in format: otac:<secure-random-string>
    """
    # 32 bytes = 256 bits of entropy
    random_string = secrets.token_urlsafe(32)
    return f"otac:{random_string}"


def build_sync_chain_url(current_domain: str, otac: str, remaining_domains: List[str], final_redirect_url: str) -> str:
    """
    Build the next URL in the cross-domain synchronization chain.

    Args:
        current_domain: Current domain being processed
        otac: OTAC for the next domain
        remaining_domains: List of domains still to be synced
        final_redirect_url: Final URL to redirect to after sync chain

    Returns:
        URL for the next domain in the chain
    """
    if not remaining_domains:
        # End of chain, redirect to final URL
        return final_redirect_url

    # Get next domain in chain
    next_domain = remaining_domains[0]
    remaining_after_next = remaining_domains[1:]

    # Build sync URL for next domain
    sync_params = {"otac": otac, "final": final_redirect_url}

    # Add remaining domains if any
    if remaining_after_next:
        sync_params["next"] = ",".join(remaining_after_next)

    # Ensure domain has protocol
    if not next_domain.startswith(("http://", "https://")):
        next_domain = f"https://{next_domain}"

    # Build full sync URL
    sync_url = f"{next_domain}/auth/sync?{urlencode(sync_params)}"
    return sync_url


def parse_sync_request(query_params: dict) -> Tuple[Optional[str], List[str], Optional[str]]:
    """
    Parse parameters from a cross-domain sync request.

    Args:
        query_params: Query parameters from the sync request

    Returns:
        Tuple of (otac, remaining_domains, final_redirect_url)
    """
    otac = query_params.get("otac")
    final_url = query_params.get("final")

    # Parse remaining domains
    remaining_domains = []
    next_param = query_params.get("next")
    if next_param:
        remaining_domains = [domain.strip() for domain in next_param.split(",") if domain.strip()]

    return otac, remaining_domains, final_url


def validate_otac_format(otac: str) -> bool:
    """
    Validate OTAC format.

    Args:
        otac: OTAC string to validate

    Returns:
        True if format is valid, False otherwise
    """
    if not otac:
        return False

    parts = otac.split(":", 1)
    return len(parts) == 2 and parts[0] == "otac" and len(parts[1]) > 0


def normalize_domain(domain: str) -> str:
    """
    Normalize domain for comparison and URL building.

    Args:
        domain: Domain string (may include protocol, port, path)

    Returns:
        Normalized domain (hostname only)
    """
    if not domain:
        return ""

    # Remove protocol if present
    if "://" in domain:
        domain = domain.split("://", 1)[1]

    # Remove path if present
    if "/" in domain:
        domain = domain.split("/", 1)[0]

    # Remove port if present (keep it for localhost development)
    if ":" in domain and not domain.startswith("localhost"):
        domain = domain.split(":", 1)[0]

    return domain.lower()


def build_domain_list(primary_domain: str, sync_domains_str: str) -> List[str]:
    """
    Build list of domains for cross-domain synchronization.

    Args:
        primary_domain: Primary domain (where login was initiated)
        sync_domains_str: Comma-separated string of additional domains

    Returns:
        List of normalized domains (excluding primary domain)
    """
    domains = []

    if sync_domains_str:
        # Parse comma-separated domains
        for domain in sync_domains_str.split(","):
            domain = domain.strip()
            if domain:
                normalized = normalize_domain(domain)
                if normalized and normalized != normalize_domain(primary_domain):
                    domains.append(normalized)

    return domains


def should_initiate_sync(sync_domains: List[str]) -> bool:
    """
    Determine if cross-domain synchronization should be initiated.

    Args:
        sync_domains: List of domains to sync

    Returns:
        True if sync should be initiated, False otherwise
    """
    return len(sync_domains) > 0


def extract_domain_from_url(url: str) -> str:
    """
    Extract domain from a URL.

    Args:
        url: Full URL

    Returns:
        Domain portion of the URL
    """
    if not url:
        return ""

    try:
        parsed = urlparse(url)
        return parsed.netloc or ""
    except Exception:
        return ""
