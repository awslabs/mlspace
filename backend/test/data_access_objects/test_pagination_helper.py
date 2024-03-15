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

import pytest

from ml_space_lambda.data_access_objects.pagination_helper import (
    PaginationTokenError,
    PaginationTokenExpiredError,
    PaginationTokenIntegrityError,
    decode_pagination_token,
)

VALID_EXPIRED_TOKEN = "v3.local.XY85xJ3PpL0bcqI6md9Bt8FY0AvapjBTMAnC_NgApu_wekmdxrGMtBrLkcUHLS_sO_WiAoXAZBvbXduvy1H_SKseDmh9erIAXfbLJB5k_bCEaL-MPK9kwmQvhfppwf_pflHu3zwujCPmFoB6jaKqwdV7T8LGd14aFFlWn5_2BG5iNl5DKzu8QtI06RKQ9FuUULboJ1px6_7ynDKya4zo6j4K2PMhIK0Svu0"


def test_expired_token_pyseto():
    with pytest.raises(PaginationTokenExpiredError):
        decode_pagination_token(VALID_EXPIRED_TOKEN)


def test_invalid_base64_data():
    with pytest.raises(PaginationTokenIntegrityError):
        decode_pagination_token("v3.local.this is not a valid token")


def test_invalid_token():
    with pytest.raises(PaginationTokenError):
        decode_pagination_token("this is not a valid token")
