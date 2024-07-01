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
from unittest import mock

from ml_space_lambda.enums import EnvVariable
from ml_space_lambda.utils import mlspace_config

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
    EnvVariable.MANAGE_IAM_ROLES: "True",
    EnvVariable.KMS_INSTANCE_CONDITIONS_POLICY_ARN: "arn:aws::iam:policy/kms-instance-conditions-policy",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.utils.lambda_functions import update_instance_kms_key_conditions


@mock.patch("ml_space_lambda.utils.lambda_functions.abbreviated_instance_union")
@mock.patch("ml_space_lambda.utils.lambda_functions.kms_unsupported_instances")
@mock.patch("ml_space_lambda.utils.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.utils.lambda_functions.iam")
@mock.patch("ml_space_lambda.utils.lambda_functions.ec2")
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
def test_update_instance_kms_key_conditions_success(
    mock_ec2, mock_iam, mock_iam_manager, kms_unsupported_instances, abbreviated_instance_union
):
    mlspace_config.env_variables = {}

    paginator = mock.Mock()
    unsupported_instances = ["g5.large", "g5ad.large"]
    kms_unsupported_instances.return_value = unsupported_instances
    mock_ec2.get_paginator.return_value = paginator

    instance_types = [
        {"InstanceType": "g5.large"},
        {"InstanceType": "g5.xlarge"},
        {"InstanceType": "g5.2xlarge"},
        {"InstanceType": "g5.4xlarge"},
    ]

    paginator.paginate.return_value = [{"InstanceTypes": instance_types[:2]}, {"InstanceTypes": instance_types[2:]}]

    abbreviated_instance_union.side_effect = [["g5.large"], ["g6.large"]]

    update_instance_kms_key_conditions(mock.Mock(), mock.Mock())

    kms_unsupported_instances.assert_called()

    standard_instances = [instance_type["InstanceType"] for instance_type in instance_types]
    abbreviated_instance_union.assert_has_calls(
        [
            mock.call(mock.ANY, [".".join(["ml", instance_type]) for instance_type in unsupported_instances]),
            mock.call(standard_instances, unsupported_instances),
        ]
    )

    mock_iam.create_policy_version.assert_called_with(
        PolicyArn=TEST_ENV_CONFIG[EnvVariable.KMS_INSTANCE_CONDITIONS_POLICY_ARN],
        SetAsDefault=True,
        PolicyDocument=json.dumps(
            {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Action": [
                            "sagemaker:CreateEndpointConfig",
                            "sagemaker:CreateHyperParameterTuningJob",
                            "sagemaker:CreateNotebookInstance",
                            "sagemaker:CreateTrainingJob",
                            "sagemaker:CreateTransformJob",
                        ],
                        "Resource": "*",
                        "Effect": "Deny",
                        "Condition": {
                            "Null": {"sagemaker:VolumeKmsKey": "true"},
                            "ForAllValues:StringNotLike": {"sagemaker:InstanceTypes": ["g5.large", "g6.large"]},
                        },
                    }
                ],
            }
        ),
    )

    mock_iam_manager._delete_unused_policy_versions.assert_called_with(
        TEST_ENV_CONFIG[EnvVariable.KMS_INSTANCE_CONDITIONS_POLICY_ARN]
    )


@mock.patch("ml_space_lambda.utils.lambda_functions.abbreviated_instance_union")
@mock.patch("ml_space_lambda.utils.lambda_functions.kms_unsupported_instances")
@mock.patch("ml_space_lambda.utils.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.utils.lambda_functions.iam")
@mock.patch.dict("os.environ", {EnvVariable.MANAGE_IAM_ROLES: ""}, clear=True)
def test_update_instance_kms_key_conditions_no_dynamic_roles(
    mock_iam, mock_iam_manager, kms_unsupported_instances, abbreviated_instance_union
):
    mlspace_config.env_variables = {}

    update_instance_kms_key_conditions(mock.Mock(), mock.Mock())

    kms_unsupported_instances.assert_not_called()
    abbreviated_instance_union.assert_not_called()
    mock_iam.create_policy_version.assert_not_called()
    mock_iam_manager._delete_unused_policy_versions.assert_not_called()


@mock.patch("ml_space_lambda.utils.lambda_functions.abbreviated_instance_union")
@mock.patch("ml_space_lambda.utils.lambda_functions.kms_unsupported_instances")
@mock.patch("ml_space_lambda.utils.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.utils.lambda_functions.iam")
@mock.patch("ml_space_lambda.utils.lambda_functions.ec2")
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
def test_update_instance_kms_key_conditions_fail(
    mock_ec2, mock_iam, mock_iam_manager, kms_unsupported_instances, abbreviated_instance_union
):
    mlspace_config.env_variables = {}

    mock_iam_manager._delete_unused_policy_versions.side_effect = Exception("test failure")

    paginator = mock.Mock()
    unsupported_instances = ["g5.large", "g5ad.large"]
    kms_unsupported_instances.return_value = unsupported_instances
    mock_ec2.get_paginator.return_value = paginator

    instance_types = [
        {"InstanceType": "g5.large"},
        {"InstanceType": "g5.xlarge"},
        {"InstanceType": "g5.2xlarge"},
        {"InstanceType": "g5.4xlarge"},
    ]

    paginator.paginate.return_value = [{"InstanceTypes": instance_types[:2]}, {"InstanceTypes": instance_types[2:]}]

    abbreviated_instance_union.side_effect = [["g5.large"], ["g6.large"]]

    assert "unable to update kms policy" == update_instance_kms_key_conditions(mock.Mock(), mock.Mock())

    kms_unsupported_instances.assert_called()
    mock_iam.create_policy_version.assert_called()
    mock_iam_manager._delete_unused_policy_versions.assert_called()
