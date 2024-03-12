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

import boto3

from ml_space_lambda.utils.common_functions import api_wrapper
from ml_space_lambda.utils.mlspace_config import (
    get_environment_variables,
    pull_config_from_s3,
    retry_config,
)

sagemaker = boto3.client("sagemaker", config=retry_config)


@api_wrapper
def describe(event, context):
    env_variables = get_environment_variables()

    s3_config = pull_config_from_s3()

    notebook_lifecycle_config = sagemaker.describe_notebook_instance_lifecycle_config(
        NotebookInstanceLifecycleConfigName=s3_config["pSMSLifecycleConfigName"]
    )
    notebook_lifecycle_config.pop("ResponseMetadata")

    response = {
        "environmentVariables": env_variables,
        "s3ParamFile": s3_config,
        "notebookLifecycleConfig": notebook_lifecycle_config,
    }

    return response
