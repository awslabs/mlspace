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
import os
from unittest import mock

import pytest

from ml_space_lambda.data_access_objects.dataset import DatasetModel
from ml_space_lambda.enums import DatasetType


# Adds global ENV variables unless they are overwritten by the test
def pytest_generate_tests(metafunc):
    # Provides the location of the LAMBDA_TASK_ROOT which is used by the 'retrieve' function to identify built-in training algorithms
    os.environ["LAMBDA_TASK_ROOT"] = "./src/"


@pytest.fixture
def mock_global_dataset():
    return DatasetModel(
        scope=DatasetType.GLOBAL.value,
        name="example_dataset",
        description="example_dataset for unit tests",
        location="s3://mlspace-data-bucket/global/datasets/example_dataset",
        created_by="gshelby",
    )


@pytest.fixture
def mock_private_dataset():
    return DatasetModel(
        scope="tshelby",
        name="example_private_dataset",
        description="example_private_dataset for unit tests",
        location="s3://mlspace-data-bucket/private/tshelby/datasets/example_private_dataset",
        created_by="tshelby",
    )


@pytest.fixture
def mock_s3_param_json():
    return {
        "pSMSKMSKeyId": "example_key_id",
        "pSMSRoleARN": "mock_iam_role_from_s3_config",
        "pSMSSecurityGroupId": ["example_security_group_id"],
        "pSMSLifecycleConfigName": "fakeLifecycleConfig",
        "pSMSSubnetIds": "subnet1,subnet2,subnet3",
    }


# Abbreviated example of an OIDC well known config response
@pytest.fixture
def mock_well_known_config():
    resp = mock.Mock()
    resp.data = json.dumps(
        {
            "issuer": "https://example-oidc.com/realms/mlspace",
            "authorization_endpoint": "https://example-oidc.com/realms/mlspace/protocol/openid-connect/auth",
            "token_endpoint": "https://example-oidc.com/realms/mlspace/protocol/openid-connect/token",
            "introspection_endpoint": "https://example-oidc.com/realms/mlspace/protocol/openid-connect/token/introspect",
            "userinfo_endpoint": "https://example-oidc.com/realms/mlspace/protocol/openid-connect/userinfo",
            "end_session_endpoint": "https://example-oidc.com/realms/mlspace/protocol/openid-connect/logout",
            "frontchannel_logout_session_supported": True,
            "frontchannel_logout_supported": True,
            "jwks_uri": "https://example-oidc.com/realms/mlspace/protocol/openid-connect/certs",
            "check_session_iframe": "https://example-oidc.com/realms/mlspace/protocol/openid-connect/login-status-iframe.html",
            "grant_types_supported": [
                "authorization_code",
                "implicit",
                "refresh_token",
                "password",
                "client_credentials",
                "urn:ietf:params:oauth:grant-type:device_code",
                "urn:openid:params:grant-type:ciba",
            ],
            "acr_values_supported": ["0", "1"],
            "response_types_supported": [
                "code",
                "none",
                "id_token",
                "token",
                "id_token token",
                "code id_token",
                "code token",
                "code id_token token",
            ],
            "subject_types_supported": ["public", "pairwise"],
            "mtls_endpoint_aliases": {
                "token_endpoint": "https://example-oidc.com/realms/mlspace/protocol/openid-connect/token",
                "revocation_endpoint": "https://example-oidc.com/realms/mlspace/protocol/openid-connect/revoke",
                "introspection_endpoint": "https://example-oidc.com/realms/mlspace/protocol/openid-connect/token/introspect",
                "device_authorization_endpoint": "https://example-oidc.com/realms/mlspace/protocol/openid-connect/auth/device",
                "registration_endpoint": "https://example-oidc.com/realms/mlspace/clients-registrations/openid-connect",
                "userinfo_endpoint": "https://example-oidc.com/realms/mlspace/protocol/openid-connect/userinfo",
                "pushed_authorization_request_endpoint": "https://example-oidc.com/realms/mlspace/protocol/openid-connect/ext/par/request",
                "backchannel_authentication_endpoint": "https://example-oidc.com/realms/mlspace/protocol/openid-connect/ext/ciba/auth",
            },
        }
    ).encode("utf-8")
    return resp


@pytest.fixture
def mock_oidc_jwks_keys():
    resp = mock.Mock()
    resp.data = json.dumps(
        {
            "keys": [
                {
                    "kid": "_oW4dLLlbSYpQ5GjRcVrVXQAhYrOw8MCoXSHvYN3_14",
                    "kty": "RSA",
                    "alg": "RSA-OAEP",
                    "use": "enc",
                    "n": "s2GdgSh2uBgibeVrOZA9Fm7WkmLAMzLHFdAlMpKyvy81ehIRbSlgspXxU_7A1iTLNV-v9GkW2Wk9LTW7C0BrMZrQEAgVzESXVjC7pCIA2Eg70VsSQtziYXlS1oWxZrdwGFQcdNNY9a1rBuZc0X4R8_d9cAOqlt3PFUFP9yNRb0G8kccfO11tiC5RXYP-JZnOqZeVsonlhcdqYVJJrZZOkRryGryiZTtttPE7SKKzAl34CeDezGdbnJNInLGfMzQjYqToFY4puLBGyhD8_2ynUPSI_rnBFW30Ox9isUTUFPaR8GIYeGCJSLdQLODqqLl-5OIsx5Wn0DcbpGr4lD_8bw",
                    "e": "AQAB",
                    "x5c": [
                        "MIICmTCCAYECBgGFnalXPTANBgkqhkiG9w0BAQsFADAQMQ4wDAYDVQQDDAVrdGVzdDAeFw0yMzAxMTAyMTQ4MThaFw0zMzAxMTAyMTQ5NThaMBAxDjAMBgNVBAMMBWt0ZXN0MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAs2GdgSh2uBgibeVrOZA9Fm7WkmLAMzLHFdAlMpKyvy81ehIRbSlgspXxU/7A1iTLNV+v9GkW2Wk9LTW7C0BrMZrQEAgVzESXVjC7pCIA2Eg70VsSQtziYXlS1oWxZrdwGFQcdNNY9a1rBuZc0X4R8/d9cAOqlt3PFUFP9yNRb0G8kccfO11tiC5RXYP+JZnOqZeVsonlhcdqYVJJrZZOkRryGryiZTtttPE7SKKzAl34CeDezGdbnJNInLGfMzQjYqToFY4puLBGyhD8/2ynUPSI/rnBFW30Ox9isUTUFPaR8GIYeGCJSLdQLODqqLl+5OIsx5Wn0DcbpGr4lD/8bwIDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQCG6HYhrEKn3ts9QRWr0FMRlMh5pbiFIAIuxyFuKorflzKih+c83FREJAJXN3cBtUIGIkaXKYA70H6NZ2ED17s13cZ4qcxGPwMVaOBFXR51AnCbc8NEijn+HCFGZfZBlWldktptZCobJnijsEAGj1yjMy013ha6UCcHlGkD6rgRA1cbXwLs/2HcfaUfeiN0fT5AQiR9qVXAsCYCKOhIPsVk+LdQhNxX6aiwsBRb9Gq4JAX74j6GkBk5Jh9hz4vJP/gjzdR1oAaj+16niTso0n/jzWbLvt+ExGf1LnBcEwCP8C43Szme2oI2BAVBqCLXzT0M/a0am9wAIib6342ZNxYc"
                    ],
                    "x5t": "h7XqN6Gmy4PmDCsBgs2yRoSurYo",
                    "x5t#S256": "V4WNmu_emaeNMLwRIjD8u7XRkR32xEsRI4Jz_8vr12I",
                },
                {
                    "kid": "GLptrSDjXhtLZfjbgEjpmZy4r6CtwWnNg6k-Oyfd864",
                    "kty": "RSA",
                    "alg": "RS256",
                    "use": "sig",
                    "n": "yrEi7WxRM1kOl3HEh9ZBumz5zbfDCusfuAz71tirrhNnRgnCrrMFBZSnU4d3J7ymSlCQbbnxwgyr-kuDn56d5czFO5LF9moRp-Cnq8trkRsMDfbv0mTeml5Pv9PzvWcAXwZINcaiHy4jw_2OhEPU2ziOnneMfGsVQzB7req3av3GWDTxZvXJp8UNfFo4RQkdQy43PvsE5yRl9V9RLYyUt3FG4TwWK4B6gt8sjmWMdKnz1HCPBS5boqmW79XnQ-C7xmxyMX8QxEoUnaIy_bK4ReOCngS-d4rEKUxJtbzj1jfm77YisurpAgV6BBb6aPAwzIIRmszPK3S4CsTHWxIYcw",
                    "e": "AQAB",
                    "x5c": [
                        "MIICmTCCAYECBgGFnalUujANBgkqhkiG9w0BAQsFADAQMQ4wDAYDVQQDDAVrdGVzdDAeFw0yMzAxMTAyMTQ4MThaFw0zMzAxMTAyMTQ5NThaMBAxDjAMBgNVBAMMBWt0ZXN0MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyrEi7WxRM1kOl3HEh9ZBumz5zbfDCusfuAz71tirrhNnRgnCrrMFBZSnU4d3J7ymSlCQbbnxwgyr+kuDn56d5czFO5LF9moRp+Cnq8trkRsMDfbv0mTeml5Pv9PzvWcAXwZINcaiHy4jw/2OhEPU2ziOnneMfGsVQzB7req3av3GWDTxZvXJp8UNfFo4RQkdQy43PvsE5yRl9V9RLYyUt3FG4TwWK4B6gt8sjmWMdKnz1HCPBS5boqmW79XnQ+C7xmxyMX8QxEoUnaIy/bK4ReOCngS+d4rEKUxJtbzj1jfm77YisurpAgV6BBb6aPAwzIIRmszPK3S4CsTHWxIYcwIDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQA0+y+7vVPvM5XC0U4P9U0dS9g9Bvz9dmpSeqP0CQ/ORs3XVTre6ZBW0FZqHT0YlLOrD4cCNNTQ/5BaChRyeoD1YcUoAiOZjF5bWFtF7tzWEiw6tW/QAHKBVjelxc/fVTxIrVnaiNMbuwjAC1PlnE80fztRgEpcxTk6anImhhUQyJBjwpaxYHsARUASXlknhANZrXaHwmUaBcpqXg4HI66i75PoSd47gRHsBQoDu0WnVx6FUXEZ6DNYnXarZomhiyEqcEzB20wC1Q06jexX/QE4dKRUaPs3Km2OlGti0Z2OKomsJT1EiTzmEjlfuywDIz1BEZDXALnu5etbXX0fBEwk"
                    ],
                    "x5t": "pCbkIqLBCmR8afmkuKy0JdRMYnM",
                    "x5t#S256": "vY0gv2oXexqn_XkTY8vjen6tHVIfqTCQwRyLiIyyjK4",
                },
            ]
        }
    ).encode("utf-8")
    return resp
