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
import logging

import boto3

from ml_space_lambda.utils.common_functions import api_wrapper, retry_config

logger = logging.getLogger(__name__)

translate = boto3.client("translate", config=retry_config)


@api_wrapper
def translate_text(event, context):
    event_body = json.loads(event["body"])

    args = _get_common_args(event_body)

    # Required fields for translate_text
    args["Text"] = event_body["Text"]

    return translate.translate_text(**args)


@api_wrapper
def translate_document(event, context):
    event_body = json.loads(event["body"])

    args = _get_common_args(event_body)

    # Required fields for translate_document
    # Since typescript doesn't have bytes we are expecting a byte array input as a list of primitive numerics
    args["Document"] = event_body["Document"]
    args["Document"]["Content"] = bytes(bytearray(args["Document"]["Content"]))

    # Convert the bytes back to an int array of byte-sized ints
    response = translate.translate_document(**args)
    response["TranslatedDocument"]["Content"] = list(response["TranslatedDocument"]["Content"])
    return response


def _get_common_args(event_body: dict) -> dict:
    args = {}
    # Required fields
    args["SourceLanguageCode"] = event_body["SourceLanguageCode"]
    args["TargetLanguageCode"] = event_body["TargetLanguageCode"]

    # Conditional fields
    if "TerminologyNames" in event_body:
        args["TerminologyNames"] = event_body["TerminologyNames"]
    if "Settings" in event_body:
        args["Settings"] = event_body["Settings"]
    return args
