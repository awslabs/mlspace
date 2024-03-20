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
import re
from urllib.parse import unquote

import boto3
from botocore.config import Config

from ml_space_lambda.data_access_objects.dataset import DatasetDAO, DatasetModel
from ml_space_lambda.enums import DatasetType
from ml_space_lambda.utils.common_functions import api_wrapper, retry_config
from ml_space_lambda.utils.exceptions import ResourceNotFound
from ml_space_lambda.utils.mlspace_config import get_environment_variables

s3 = boto3.client(
    "s3",
    config=Config(
        retries={
            "max_attempts": 3,
            "mode": "standard",
        },
        signature_version="s3v4",
    ),
)
s3_resource = boto3.resource("s3", config=retry_config)
dataset_dao = DatasetDAO()

dataset_description_regex = re.compile(r"[^\w\-\s'.]")


def get_dataset_prefix(scope, dataset_name):
    dataset = dataset_dao.get(scope, dataset_name)
    if not dataset:
        raise LookupError(f"Requested dataset, '{dataset_name}' does not exist.")
    return dataset.prefix


@api_wrapper
def delete(event, context):
    scope = event["pathParameters"]["scope"].replace('"', "")
    dataset_name = event["pathParameters"]["datasetName"].replace('"', "")

    env_variables = get_environment_variables()
    bucket = s3_resource.Bucket(env_variables["DATA_BUCKET"])
    # Grab the dataset info from dynamo and do the delete using the metadata
    s3_prefix = get_dataset_prefix(scope, dataset_name)
    bucket.objects.filter(Prefix=s3_prefix).delete()
    dataset_dao.delete(scope, dataset_name)

    return f"Successfully deleted {dataset_name}"


@api_wrapper
def delete_file(event, context):
    scope = event["pathParameters"]["scope"].replace('"', "")
    dataset_name = event["pathParameters"]["datasetName"].replace('"', "")
    file = unquote(event["pathParameters"]["file"])
    env_variables = get_environment_variables()
    key = f"{get_dataset_prefix(scope, dataset_name)}{file}"

    return s3.delete_object(Bucket=env_variables["DATA_BUCKET"], Key=key)


@api_wrapper
def edit(event, context):
    body = json.loads(event["body"])
    scope = event["pathParameters"]["scope"]
    dataset_name = event["pathParameters"]["datasetName"]

    dataset = dataset_dao.get(scope, dataset_name)
    if not dataset:
        raise ResourceNotFound(f"Dataset '{dataset_name}' does not exist.")
    # Merge updates into the original item. Only a subset of the fields
    if "description" in body:
        if len(body["description"]) > 254:
            raise Exception("Dataset description is over the max length of 254 characters.")
        if dataset_description_regex.search(body["description"]):
            raise Exception("Dataset description contains invalid character.")

    # will get updated anyway
    original = dataset.to_dict()
    original.update(body)

    # Update the item
    dataset_dao.update(scope, dataset_name, DatasetModel.from_dict(original))

    return f"Successfully updated {dataset_name}."


@api_wrapper
def get(event, context):
    scope = event["pathParameters"]["scope"]
    dataset_name = event["pathParameters"]["datasetName"]

    dataset = dataset_dao.get(scope, dataset_name)
    if dataset:
        return dataset.to_dict()

    raise ResourceNotFound(f"Dataset '{dataset_name}' does not exist.")


@api_wrapper
def presigned_url(event, context):
    response = ""
    body = json.loads(event["body"])
    key = body["key"]
    scope_from_key = key.split("/")[1]
    type_from_key = key.split("/")[0]
    # Ensure the headers match the values derived from the request key
    if (
        type_from_key != event["headers"]["x-mlspace-dataset-type"]
        or scope_from_key != event["headers"]["x-mlspace-dataset-scope"]
    ):
        raise Exception("Dataset headers do not match expected type and scope.")

    is_upload = body.get("isUpload", False)
    env_variables = get_environment_variables()

    # check if upload or download
    if is_upload:
        fields = body["fields"]
        conditions = body["conditions"]

        # Set derived values for conditions and fields
        username = event["requestContext"]["authorizer"]["principalId"]
        name_from_key = key.split("/")[2]

        # Conditions is an array of dictionaries
        conditions.append({"x-amz-meta-user": username})
        conditions.append({"x-amz-meta-dataset-name": name_from_key})
        # S3 scope tag is an SMS legacy tag and actually corresponds to what
        # is referred to as dataset type in MLS
        conditions.append({"x-amz-meta-dataset-scope": type_from_key})

        # Fields is just a regular dictionary
        fields["x-amz-meta-user"] = username
        fields["x-amz-meta-dataset-name"] = name_from_key
        fields["x-amz-meta-dataset-scope"] = type_from_key

        # Tags is an XML structure that consists of all the conditions we have
        tagging_value = "<Tagging><TagSet>"
        for field_key in fields:
            tag_key = field_key.replace("x-amz-meta-", "")
            tagging_value += f"<Tag><Key>{tag_key}</Key><Value>{fields[field_key]}</Value></Tag>"
        tagging_value += "</TagSet></Tagging>"

        fields["tagging"] = tagging_value
        conditions.append({"tagging": tagging_value})

        response = s3.generate_presigned_post(
            Bucket=env_variables["DATA_BUCKET"],
            Key=key,
            Fields=fields,
            Conditions=conditions,
            ExpiresIn=3600,
        )

    else:
        response = s3.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": env_variables["DATA_BUCKET"], "Key": key},
            ExpiresIn=3600,
        )
    return response


@api_wrapper
def create_dataset(event, context):
    body = json.loads(event["body"])
    dataset_type = body.get("datasetType")
    dataset_name = body.get("datasetName")
    env_variables = get_environment_variables()

    if dataset_type == DatasetType.GLOBAL.value:
        scope = "global"
        directory_name = f"global/datasets/{dataset_name}/"
    else:
        scope = body.get("datasetScope")  # username or project name for private/project scope respectively
        directory_name = f"{dataset_type}/{scope}/datasets/{dataset_name}/"

    if dataset_type != event["headers"]["x-mlspace-dataset-type"] or scope != event["headers"]["x-mlspace-dataset-scope"]:
        raise Exception("Dataset headers do not match expected type and scope.")

    if not dataset_dao.get(scope, dataset_name):
        dataset_location = f's3://{env_variables["DATA_BUCKET"]}/{directory_name}'
        dataset = DatasetModel(
            scope=scope,
            name=dataset_name,
            description=body.get("datasetDescription", ""),
            format=body.get("datasetFormat", "text/plain"),
            location=dataset_location,
            created_by=event["requestContext"]["authorizer"]["principalId"],
        )
        dataset_dao.create(dataset)
        return {"status": "success", "dataset": dataset.to_dict()}
    else:
        raise Exception(f"Dataset {dataset_name} already exists.")


@api_wrapper
def list_resources(event, context):
    username = event["requestContext"]["authorizer"]["principalId"]
    datasets = []
    # Get global datasets
    datasets = dataset_dao.get_all_for_scope(DatasetType.GLOBAL, DatasetType.GLOBAL.value)
    # Get the users private datasets
    datasets.extend(dataset_dao.get_all_for_scope(DatasetType.PRIVATE, username))

    if event["pathParameters"] and "projectName" in event["pathParameters"]:
        project_name = event["pathParameters"]["projectName"].replace('"', "")
        # Get project datasets
        datasets.extend(dataset_dao.get_all_for_scope(DatasetType.PROJECT, project_name))

    return [dataset.to_dict() for dataset in datasets]


@api_wrapper
def list_locations(event, context):
    scope = event["pathParameters"]["scope"].replace('"', "")
    type = event["pathParameters"]["type"].replace('"', "")
    datasets_locations = []

    datasets = dataset_dao.get_all_for_scope(DatasetType[type.upper()], scope)

    for dataset in datasets:
        datasets_locations.append(
            {
                "name": dataset.name,
                "location": dataset.location,
            }
        )

    env_variables = get_environment_variables()

    return {"bucket": f's3://{env_variables["DATA_BUCKET"]}', "locations": datasets_locations}


@api_wrapper
def list_files(event, context):
    prefix = get_dataset_prefix(event["pathParameters"]["scope"], event["pathParameters"]["datasetName"])

    env_variables = get_environment_variables()
    keys = []

    if event["queryStringParameters"]:
        s3_response = s3.list_objects_v2(
            Bucket=env_variables["DATA_BUCKET"],
            Prefix=prefix,
            ContinuationToken=event["queryStringParameters"].get("nextToken", ""),
        )
    else:
        s3_response = s3.list_objects_v2(Bucket=env_variables["DATA_BUCKET"], Prefix=prefix)

    for object in s3_response.get("Contents", []):
        keys.append({"key": object["Key"], "size": object["Size"]})

    # Note: For s3_response if there are no files, the path to the dataset is returned
    # Remove the dataset path to correctly reflect there are no files in the dataset
    if len(keys) == 1 and keys[0]["key"] == prefix:
        keys = []

    response = {
        "Keys": keys,
    }

    if "NextContinuationToken" in s3_response:
        response["nextToken"] = s3_response["NextContinuationToken"]

    return response
