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

# This lambda gets invoked whenever there's an S3 upload event
import logging
from urllib.parse import unquote_plus

import boto3

from ml_space_lambda.data_access_objects.dataset import DatasetDAO, DatasetModel
from ml_space_lambda.enums import DatasetType, EnvVariable
from ml_space_lambda.utils.common_functions import event_wrapper, retry_config
from ml_space_lambda.utils.mlspace_config import get_environment_variables

logger = logging.getLogger(__name__)

s3 = boto3.client("s3", config=retry_config)
dataset_dao = DatasetDAO()


def _create_dataset_record(metadata, key):
    # Scope and name need to come from the key as opposed to metadata tags
    split_key = key.split("/")
    dataset_type = split_key[0].lower()
    dataset_location = ""

    env_variables = get_environment_variables()

    if dataset_type == DatasetType.GLOBAL:
        scope = DatasetType.GLOBAL
        dataset_name = split_key[2]
        dataset_location = f"s3://{env_variables[EnvVariable.DATA_BUCKET]}/global/datasets/{dataset_name}/"
    elif dataset_type in [DatasetType.PRIVATE, DatasetType.PROJECT, DatasetType.GROUP]:
        scope = split_key[1]
        dataset_name = split_key[3]
        dataset_location = f"s3://{env_variables[EnvVariable.DATA_BUCKET]}/{dataset_type}/{scope}/datasets/{dataset_name}/"
    else:
        logger.error(f"Failed to determine dataset from key '{key}'")
        raise KeyError("Failed to determine corresponding dataset")

    if not dataset_dao.get(scope, dataset_name):
        dataset = DatasetModel(
            scope=scope,
            type=dataset_type,
            name=dataset_name,
            description=metadata.get("dataset-description", ""),
            location=dataset_location,
            created_by=metadata.get("user", "default-user"),
            is_group=dataset_type == DatasetType.GROUP,
        )
        dataset_dao.create(dataset)


def _handle_front_end_upload(bucket, key):
    s3_response = s3.head_object(Bucket=bucket, Key=key)
    metadata = s3_response["Metadata"]
    if metadata.get("user", "") == "":
        s3_response = s3.head_object(Bucket=bucket, Key=key)
        metadata = s3_response["Metadata"]
    tags_response = s3.get_object_tagging(Bucket=bucket, Key=key)
    tag_set = tags_response["TagSet"]
    tags = (
        "dataset-scope",
        "dataset-name",
        "user",
    )

    # Do some basic verification. Check that there is at least metadata in the object and that
    # there are tags
    tags_verified = False
    if metadata:
        for s3_tag in tag_set:
            if s3_tag["Key"] in tags and s3_tag["Value"]:
                tags_verified = True

    if tags_verified is True:
        _create_dataset_record(metadata, key)


def _handle_notebook_upload(bucket, key, username):
    # Split the S3 key and use it to determine the dataset type and scope
    split_key = key.split("/")

    # TODO: Is there anyway we can get the actual dataset creator here?
    type = split_key[0].lower()
    values = {}
    if type == DatasetType.GLOBAL:
        values = {"dataset-scope": DatasetType.GLOBAL, "dataset-name": split_key[2]}
    elif type in [DatasetType.PRIVATE, DatasetType.PROJECT, DatasetType.GROUP]:
        values = {"dataset-scope": split_key[1], "dataset-name": split_key[3]}
    else:
        logger.error(f"Unrecognized dataset type {type} (Bucket: {bucket}, Key: {key}")

    if values:
        values["user"] = username
        # Tag the s3 object
        tag_set = {"TagSet": [{"Key": k, "Value": v} for k, v in values.items()]}
        s3_response = s3.put_object_tagging(Bucket=bucket, Key=key, Tagging=tag_set)

        if s3_response["ResponseMetadata"]["HTTPStatusCode"] == 200:
            _create_dataset_record(values, key)
        else:
            logger.error(f"Failed to tag dataset (Bucket: {bucket}, Key: {key}")


def _check_key(key):
    """
    We only want to execute the tagging and insertion into Dynamo logic for files that are part of
    datasets. Datasets uploaded from MLSpace will be one level deep after the word 'datasets',
    e.g. /datasets/dataset-name. Datasets created/written to from a notebook can have a much deeper
    hierarchy. Files generated via notebook may not have all the tags that a file from the UI will
    have since the tags don't exist that means the dataset metadata won't either but none of those
    fields really matter.
    """
    try:
        split_key = key.split("/")
        index = split_key.index("datasets")
        length = len(split_key) - 1
        depth = length - index
        if depth >= 2:
            return True
        else:
            return False
    except Exception:
        return False


# s3-event-put-notification
@event_wrapper
def lambda_handler(event, context):
    bucket = event["Records"][0]["s3"]["bucket"]["name"]
    key = unquote_plus(event["Records"][0]["s3"]["object"]["key"])
    requester_arn = event["Records"][0]["userIdentity"]["principalId"]

    # Trigger the function logic only if there's an indication that this is a user uploaded dataset
    result = _check_key(key)
    if result:
        # If the request came from the UI, run this code
        if "mls-lambda" in requester_arn:
            _handle_front_end_upload(bucket, key)
        # Else, request is coming from a notebook and we have to create some reasonable tags
        # derived from the S3 key
        else:
            _handle_notebook_upload(bucket, key, "default-user")
