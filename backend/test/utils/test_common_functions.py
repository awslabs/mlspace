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
from typing import Any, Dict
from unittest import mock

import pytest
from botocore.exceptions import ClientError

from ml_space_lambda.utils.common_functions import (
    api_wrapper,
    generate_exception_response,
    generate_html_response,
    generate_tags,
    list_custom_terminologies_for_project,
)

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
    "BUCKET": "testS3Bucket",
    "S3_KEY": "testS3Key",
}
MOCK_PROJECT_NAME = "mock_project1"
mock_list_batch_translate_response = {
    "TextTranslationJobPropertiesList": [
        {
            "JobId": "123abc",
            "JobName": MOCK_PROJECT_NAME + "-test_job_name",
        }
    ],
    "NextToken": "123abc",
}


@pytest.mark.parametrize("status_code,body", [("200", {"status": "success"}), ("400", "generic error string")])
def test_generate_html_response(status_code, body):
    expected_output = {
        "statusCode": status_code,
        "body": json.dumps(body, default=str),
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
            "Cache-Control": "no-store, no-cache",
            "Pragma": "no-cache",
            "Strict-Transport-Security": "max-age:47304000; includeSubDomains",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
        },
    }
    return_value = generate_html_response(status_code, body)
    assert return_value == expected_output


@pytest.mark.parametrize(
    "response,expected_response",
    [
        (
            {
                "Error": {"Code": "MissingParameter", "Message": "Dummy error message."},
                "ResponseMetadata": {"HTTPStatusCode": 403},
            },
            generate_html_response(
                403,
                "An error occurred (MissingParameter) when calling the TestClientCall operation: Dummy error message.",
            ),
        ),
        (
            "'pathParameters'",
            generate_html_response(400, "Missing event parameter: 'pathParameters'"),
        ),
        (
            {"Error": {"Code": "MissingParameter", "Message": "Dummy error message."}},
            generate_html_response(
                400,
                "An error occurred (MissingParameter) when calling the TestClientCall operation: Dummy error message.",
            ),
        ),
    ],
)
def test_generate_exception_response(response, expected_response):
    error = response
    if response != "'pathParameters'":
        error = ClientError(response, "TestClientCall")
    assert generate_exception_response(error) == expected_response


@pytest.mark.parametrize(
    "user_name,project_name,system_tag",
    [("test_username", "test_project_name", "test_system_tag")],
)
def test_generate_tags(user_name: str, project_name: str, system_tag: str):
    expected_tags = [
        {"Key": "user", "Value": user_name},
        {"Key": "project", "Value": project_name},
        {"Key": "system", "Value": system_tag},
    ]
    return_value = generate_tags(user_name, project_name, system_tag)
    assert return_value == expected_tags


@mock.patch("ml_space_lambda.utils.common_functions.logger")
def test_api_wrapper_redact_token(mock_logger):
    fake_token = "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJfOHZYRGxURVdyMElsRHA0SFg5MThKeDUyNFZPS0pWR1BzcnZaLUxrMUd3In0.eyJleHAiOjE2ODI0OTE1MDYsImlhdCI6MTY4MjQ4NDYwNiwiYXV0aF90aW1lIjoxNjgyNDg0NTg2LCJqdGkiOiI5ZjZjMzYxMS0xMzIzLTRiYTYtODA0YS0zNmIxMTJkMWVkOWMiLCJpc3MiOiJodHRwczovL2VjMi0zLTg5LTE5NS0yNi5jb21wdXRlLTEuYW1hem9uYXdzLmNvbS9yZWFsbXMvbWxzcGFjZSIsImF1ZCI6IndlYi1jbGllbnQiLCJzdWIiOiJmY2QzMGM5Ny1hOTM5LTRjOTQtOWRlMy04NTIyYWJjODBlNmIiLCJ0eXAiOiJJRCIsImF6cCI6IndlYi1jbGllbnQiLCJzZXNzaW9uX3N0YXRlIjoiNWU3MzRkYmItNzAyNy00N2FmLTgxNDAtMGFkMzA3ODRmNzc5IiwiYXRfaGFzaCI6ImM0UWpfZ2JKUnM5UG1saUUxS3VrWUEiLCJhY3IiOiIwIiwic2lkIjoiNWU3MzRkYmItNzAyNy00N2FmLTgxNDAtMGFkMzA3ODRmNzc5IiwiZW1haWxfdmVyaWZpZWQiOnRydWUsIm5hbWUiOiJJbXJhbiBBaG1lZCIsInByZWZlcnJlZF91c2VybmFtZSI6ImFobWVkZ2ltIiwiZ2l2ZW5fbmFtZSI6IkltcmFuIiwiZmFtaWx5X25hbWUiOiJBaG1lZCIsImVtYWlsIjoiYWhtZWRnaW1AYW1hem9uLmNvbSJ9.sB4DH9NTBmOXLPr3NIHtpzroFhvCxAp88sxocCNdKlSgqw16fygasZJSrwSQtNgiNljotnxl3Zm8mmERXsQ9FfRZFW5dCyQkT06XVBN9lPqomufF4z0wnG5KFe_kjuP-viwq9PrfdOqq0_ad_mhNtvgvROhaGB9ZLuN6jhnfJPIti68OhWYcltNI3mmCCYruL6U2yB6ABpehovxiCmEYJSEgz-BA17XPp6WnTNjL6qJRKVO9p7uDsoW9BpDtguQCNcf_fkwIWbpjW1xac_EFQbUEF66XB0KkMje-pMtpHbP7A9G8S_fA2QW3qdHLA8ZsXGV-_y2eoq2DRRFUxz91BQ"
    mock_context = mock.Mock()
    mock_event = {
        "resource": "/project/{projectName}",
        "path": "/project/Test1",
        "httpMethod": "GET",
        "headers": {
            "accept": "application/json, text/plain, */*",
            "accept-encoding": "gzip, deflate, br",
            "accept-language": "en-US,en;q=0.5",
            "Authorization": f"Bearer {fake_token}",
            "Host": "qbw8as6sic.execute-api.us-east-1.amazonaws.com",
            "referer": "https://qbw8as6sic.execute-api.us-east-1.amazonaws.com/Prod/",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/112.0",
            "X-Amzn-Trace-Id": "Root=1-6448b828-7166ca100cf3a9fd2d2210e1",
            "X-Forwarded-For": "152.58.16.229",
            "X-Forwarded-Port": "443",
            "X-Forwarded-Proto": "https",
        },
        "multiValueHeaders": {
            "accept": ["application/json, text/plain, */*"],
            "accept-encoding": ["gzip, deflate, br"],
            "accept-language": ["en-US,en;q=0.5"],
            "Authorization": [f"Bearer {fake_token}"],
            "Host": ["qbw8as6sic.execute-api.us-east-1.amazonaws.com"],
            "referer": ["https://qbw8as6sic.execute-api.us-east-1.amazonaws.com/Prod/"],
            "sec-fetch-dest": ["empty"],
            "sec-fetch-mode": ["cors"],
            "sec-fetch-site": ["same-origin"],
            "User-Agent": ["Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/112.0"],
            "X-Amzn-Trace-Id": ["Root=1-6448b828-7166ca100cf3a9fd2d2210e1"],
            "X-Forwarded-For": ["152.58.16.229"],
            "X-Forwarded-Port": ["443"],
            "X-Forwarded-Proto": ["https"],
        },
        "queryStringParameters": None,
        "multiValueQueryStringParameters": None,
        "pathParameters": {"projectName": "Test1"},
        "stageVariables": None,
        "requestContext": {
            "resourceId": "82w77u",
            "authorizer": {
                "principalId": "ahmedgim",
                "integrationLatency": 1339,
                "user": '{"username": "ahmedgim", "email": "ahmedgim@amazon.com", "displayName": "Imran Ahmed", "suspended": false, "permissions": [], "createdAt": 1676916597, "lastLogin": 1682487337}',
            },
            "resourcePath": "/project/{projectName}",
            "httpMethod": "GET",
            "extendedRequestId": "D-G2bFukoAMFoeQ=",
            "requestTime": "26/Apr/2023:05:35:36 +0000",
            "path": "/Prod/project/Test1",
            "accountId": "679683741526",
            "protocol": "HTTP/1.1",
            "stage": "Prod",
            "domainPrefix": "qbw8as6sic",
            "requestTimeEpoch": 1682487336886,
            "requestId": "e7770d75-d523-47a1-8b5e-5595bb0eca65",
            "identity": {
                "cognitoIdentityPoolId": None,
                "accountId": None,
                "cognitoIdentityId": None,
                "caller": None,
                "sourceIp": "152.58.16.229",
                "principalOrgId": None,
                "accessKey": None,
                "cognitoAuthenticationType": None,
                "cognitoAuthenticationProvider": None,
                "userArn": None,
                "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/112.0",
                "user": None,
            },
            "domainName": "qbw8as6sic.execute-api.us-east-1.amazonaws.com",
            "apiId": "qbw8as6sic",
        },
        "body": None,
        "isBase64Encoded": False,
    }
    mock_func = mock.Mock()
    mock_func.__name__ = "unit_test_wrap"
    wrapped_func = api_wrapper(mock_func)

    wrapped_func(mock_event, mock_context)

    mock_logger.info.assert_called_once()
    assert "Bearer" not in mock_logger.info.call_args.args[0]
    assert fake_token not in mock_logger.info.call_args.args[0]
    assert "<REDACTED>" in mock_logger.info.call_args.args[0]


def test_list_custom_terminologies_for_project():
    mock_translate = mock.MagicMock()
    mock_paginator = mock.MagicMock()
    mock_translate.get_paginator.return_value = mock_paginator
    mock_paginator_response = [
        {
            "TerminologyPropertiesList": [
                {
                    "Name": "custom_terminology1",
                },
                {"Name": "custom_terminology2"},
            ]
        },
        {
            "TerminologyPropertiesList": [
                {
                    "Name": "custom_terminology3",
                },
                {"Name": "custom_terminology4"},
            ]
        },
    ]
    mock_paginator.paginate.return_value = mock_paginator_response

    max_results = 123
    test_paging_options = {"pageSize": max_results}
    test_kwargs: Dict[str, Any] = {"MaxResults": max_results}

    result = list_custom_terminologies_for_project(client=mock_translate, fetch_all=True, paging_options=test_paging_options)

    mock_paginator.paginate.assert_called_with(**test_kwargs)

    expected_result = {
        "records": [
            mock_paginator_response[0]["TerminologyPropertiesList"][0],
            mock_paginator_response[0]["TerminologyPropertiesList"][1],
            mock_paginator_response[1]["TerminologyPropertiesList"][0],
            mock_paginator_response[1]["TerminologyPropertiesList"][1],
        ],
    }

    assert expected_result == result
