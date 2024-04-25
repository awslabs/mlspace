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
import time

from ml_space_lambda.data_access_objects.app_configuration import AppConfigurationDAO, AppConfigurationModel, SettingsModel
from ml_space_lambda.utils.common_functions import api_wrapper

log = logging.getLogger(__name__)
app_configuration_dao = AppConfigurationDAO()


@api_wrapper
def update_configuration(event, context):
    request = json.loads(event["body"])
    configScope = request["configScope"]
    version_id = request["versionId"] + 1  # increment so this will be the latest version

    new_configuration = SettingsModel.from_dict(request["configuration"])

    app_configuration = AppConfigurationModel(
        configScope=configScope,
        version_id=version_id,
        configuration=new_configuration,
        changed_by=event["requestContext"]["authorizer"]["principalId"],
        change_reason=request["changeReason"],
        created_at=time.time(),
    )

    try:
        # Create a record for this configuration and mark it the latest config by incrementing the version Id
        app_configuration_dao.create(config=app_configuration)
    except Exception as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            e.response["ResponseMetadata"]["HTTPStatusCode"] = 429
        raise e

    return f"Successfully updated configuration for {configScope}, version {version_id}."


@api_wrapper
def get_configuration(event, context):
    configScope = event["queryStringParameters"]["configScope"]
    num_versions = event["queryStringParameters"].get("numVersions", 1)

    return app_configuration_dao.get(configScope=configScope, num_versions=num_versions)
