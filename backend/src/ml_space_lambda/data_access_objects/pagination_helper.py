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

import json
from typing import Dict

import pyseto
from pyseto import Key, KeyInterface

PYSETO_PROTOCOL = 3

# For pagination tokens, encryption is NOT required, we're just making them opaque so a hard coded
# secret is fine
_pyseto_key: KeyInterface = Key.new(
    version=PYSETO_PROTOCOL, purpose="local", key=str.encode("Data Science Is Fun!")
)


class PaginationTokenError(Exception):
    pass


class PaginationTokenExpiredError(PaginationTokenError):
    pass


class PaginationTokenIntegrityError(PaginationTokenError):
    pass


# The point of the pagination utils is to generate an opaque and expiring pagination token
# both of which are best practice from an API standard and security standpoint
def encode_pagination_token(
    last_evaluated_key: Dict,
    valid_duration_seconds: int = 60 * 60 * 24,
) -> str:
    return str(
        pyseto.encode(_pyseto_key, last_evaluated_key, exp=valid_duration_seconds, serializer=json),
        encoding="ascii",
    )


def decode_pagination_token(
    token: str,
) -> Dict:
    try:
        pyseto_token = pyseto.decode(_pyseto_key, token, deserializer=json)
    except pyseto.exceptions.VerifyError as e:
        if str(e).startswith("Token expired"):
            raise PaginationTokenExpiredError(e)
        else:
            raise PaginationTokenIntegrityError(e)
    except pyseto.exceptions.DecryptError as e:
        raise PaginationTokenIntegrityError(e)
    except Exception as e:
        raise PaginationTokenError(e)
    # Remove expiration from the response payload since we've already
    # validated it above
    del pyseto_token.payload["exp"]

    return pyseto_token.payload
