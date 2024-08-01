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
from ml_space_lambda.data_access_objects.group_dataset import GroupDatasetDAO, GroupDatasetModel
from ml_space_lambda.data_access_objects.group_user import GroupUserDAO
from ml_space_lambda.data_access_objects.user import UserModel
from ml_space_lambda.enums import DatasetType, EnvVariable, Permission
from ml_space_lambda.utils.common_functions import api_wrapper, retry_config
from ml_space_lambda.utils.dict_utils import filter_dict_by_keys, rename_dict_keys
from ml_space_lambda.utils.exceptions import ResourceNotFound
from ml_space_lambda.utils.iam_manager import IAMManager
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
group_user_dao = GroupUserDAO()
group_dataset_dao = GroupDatasetDAO()
iam = boto3.client("iam", config=retry_config)
iam_manager = IAMManager(iam)

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
    bucket = s3_resource.Bucket(env_variables[EnvVariable.DATA_BUCKET])
    # Grab the dataset info from dynamo and do the delete using the metadata
    s3_prefix = get_dataset_prefix(scope, dataset_name)
    bucket.objects.filter(Prefix=s3_prefix).delete()
    dataset_dao.delete(scope, dataset_name)

    # TODO: create dedicated delete query for performance?
    groups_to_update = set()
    for group_dataset in group_dataset_dao.get_groups_for_dataset(dataset_name):
        group_dataset_dao.delete(group_dataset.group, group_dataset.dataset)
        groups_to_update.add(group_dataset.group)

    iam_manager.update_groups(groups_to_update)

    return f"Successfully deleted {dataset_name}"


@api_wrapper
def delete_file(event, context):
    scope = event["pathParameters"]["scope"].replace('"', "")
    dataset_name = event["pathParameters"]["datasetName"].replace('"', "")
    file = unquote(event["pathParameters"]["file"])
    env_variables = get_environment_variables()
    key = f"{get_dataset_prefix(scope, dataset_name)}{file}"

    return s3.delete_object(Bucket=env_variables[EnvVariable.DATA_BUCKET], Key=key)


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
    if dataset.type == DatasetType.GROUP:
        # get the new list of groups that have this dataset shared with them.
        # this list may be adding or removing existing groups from this dataset
        new_groups_list = body.get("groups", [])
        # get the current list of groups with access to this dataset so we can determine which groups were added/removed
        groups = group_dataset_dao.get_groups_for_dataset(dataset_name)
        old_group_names = []
        group_difference = []

        # Check for existing groups that are no longer in the group list
        for group in groups:
            old_group_names.append(group.group)
            if group.group not in new_groups_list:
                # this group was removed from the dataset
                group_dataset_dao.delete(group.group, dataset_name)
                group_difference.append(group.group)

        # Check for new groups that are not in the list of existing groups
        for new_group in new_groups_list:
            if new_group not in old_group_names:
                # this group was added to the dataset
                group_dataset_dao.create(GroupDatasetModel(dataset_name, new_group))
                group_difference.append(new_group)

        iam_manager.update_groups(group_difference)

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
    if scope == DatasetType.GROUP:
        groups = group_dataset_dao.get_groups_for_dataset(dataset_name)
        for group in groups:
            dataset.groups.append(group.group)
    if dataset:
        return dataset.to_dict()

    raise ResourceNotFound(f"Dataset '{dataset_name}' does not exist.")


def _is_scope_header_correct(type_from_key: str, scope_from_key: str, name_from_key: str, scope_header: str):
    if type_from_key != DatasetType.GROUP:
        if scope_from_key != scope_header:
            return False
    else:
        # Group datasets expect the scope header to be the name of the dataset
        if name_from_key != scope_header:
            return False
    return True


@api_wrapper
def presigned_url(event, context):
    response = ""
    body = json.loads(event["body"])
    key = body["key"]
    type_from_key = key.split("/")[0]
    scope_from_key = key.split("/")[1]
    name_from_key = key.split("/")[2]
    if type_from_key == DatasetType.GROUP:
        # for group datasets, the scope is the dataset name
        scope_from_key = name_from_key

    # Ensure the headers match the values derived from the request key
    if type_from_key != event["headers"]["x-mlspace-dataset-type"] or not _is_scope_header_correct(
        type_from_key, scope_from_key, name_from_key, event["headers"]["x-mlspace-dataset-scope"]
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
            Bucket=env_variables[EnvVariable.DATA_BUCKET],
            Key=key,
            Fields=fields,
            Conditions=conditions,
            ExpiresIn=3600,
        )

    else:
        response = s3.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": env_variables[EnvVariable.DATA_BUCKET], "Key": key},
            ExpiresIn=3600,
        )
    return response


@api_wrapper
def create_dataset(event, context):
    try:
        dataset_created = False
        group_dataset_created = False
        body = json.loads(event["body"])
        dataset_type = body.get("datasetType")
        dataset_name = body.get("datasetName")
        groups = body.get("datasetGroups", [])
        env_variables = get_environment_variables()

        if dataset_type == DatasetType.GLOBAL:
            scope = DatasetType.GLOBAL
            dataset_scope = scope
            directory_name = f"global/datasets/{dataset_name}/"
        elif dataset_type == DatasetType.GROUP:
            scope = ",".join(groups)
            dataset_scope = DatasetType.GROUP
            directory_name = f"group/datasets/{dataset_name}/"
        else:
            scope = body.get("datasetScope")  # username, group name, or project name for private/project scope respectively
            dataset_scope = scope
            directory_name = f"{dataset_type}/{scope}/datasets/{dataset_name}/"

        if dataset_type != event["headers"]["x-mlspace-dataset-type"] or scope != event["headers"]["x-mlspace-dataset-scope"]:
            raise Exception("Dataset headers do not match expected type and scope.")

        if not dataset_dao.get(dataset_scope, dataset_name):
            dataset_location = f"s3://{env_variables[EnvVariable.DATA_BUCKET]}/{directory_name}"
            dataset = DatasetModel(
                scope=dataset_scope,
                type=dataset_type,
                name=dataset_name,
                description=body.get("datasetDescription", ""),
                location=dataset_location,
                created_by=event["requestContext"]["authorizer"]["principalId"],
            )
            # For groups, create one entry per group that shares this dataset
            if dataset_type == DatasetType.GROUP:
                for group in groups:
                    group_dataset_dao.create(GroupDatasetModel(dataset_name, group))
                    group_dataset_created = True

            dataset_dao.create(dataset)
            dataset_created = True

            iam_manager.update_groups(groups)

            return {"status": "success", "dataset": dataset.to_dict()}
        else:
            raise Exception(f"Dataset {dataset_name} already exists.")
    except Exception as e:
        # Clean up any resources which may have been created prior to the error
        if dataset_created:
            dataset_dao.delete(dataset_scope, dataset_name)

        if group_dataset_created:
            for group in groups:
                group_dataset_dao.delete(dataset_name, group)
            iam_manager.update_groups(groups)

        raise e


@api_wrapper
def list_resources(event, context):
    username = event["requestContext"]["authorizer"]["principalId"]
    user = UserModel.from_dict(json.loads(event["requestContext"]["authorizer"]["user"]))

    is_admin = event["requestContext"].get("resourcePath") == "/admin/datasets"
    datasets = []

    # if this is an admin request, retrieve ALL the datasets
    if is_admin and Permission.ADMIN in user.permissions:
        datasets = dataset_dao.get_all()
        for dataset in datasets:
            # Clear list to make sure it's up to date
            dataset.groups = []
            for group_dataset in group_dataset_dao.get_groups_for_dataset(dataset.name):
                dataset.groups.append(group_dataset.group)
    else:
        # Get global datasets
        datasets = dataset_dao.get_all_for_scope(DatasetType.GLOBAL, DatasetType.GLOBAL)
        # Get the user's private datasets
        datasets.extend(dataset_dao.get_all_for_scope(DatasetType.PRIVATE, username))
        # Get the group datasets for groups this user is a member of
        group_datasets = set()
        for group in group_user_dao.get_groups_for_user(username):
            for group_dataset in group_dataset_dao.get_datasets_for_group(group.group):
                if group_dataset.dataset not in group_datasets:
                    group_datasets.add(group_dataset.dataset)
                    datasets.append(dataset_dao.get(DatasetType.GROUP, group_dataset.dataset))

        if event["pathParameters"] and "projectName" in event["pathParameters"]:
            project_name = event["pathParameters"]["projectName"].replace('"', "")
            # Get project datasets
            datasets.extend(dataset_dao.get_all_for_scope(DatasetType.PROJECT, project_name))

    return [dataset.to_dict() for dataset in datasets]


@api_wrapper
def list_files(event, context):
    env_variables = get_environment_variables()
    query_string_parameters = event.get("queryStringParameters") or {}

    # map query parameters keys to api parameter names
    query_string_parameters = rename_dict_keys(
        query_string_parameters,
        {"nextToken": "ContinuationToken", "pageSize": "MaxKeys", "prefix": "Prefix", "delimiter": "Delimiter"},
    )

    dataset_prefix = get_dataset_prefix(event["pathParameters"]["scope"], event["pathParameters"]["datasetName"])
    # this joins dataset path with the user supplied prefix
    # example: "private/aUsername/datasets/aDatasetName/" + "path/to/files/"
    computed_prefix = "".join([dataset_prefix, query_string_parameters.get("Prefix", "")])

    query_parameters = {
        "Bucket": env_variables[EnvVariable.DATA_BUCKET],
        "Prefix": computed_prefix,
        "Delimiter": "/",
    }

    # don't allow arbitrary query string parameters added to the query_parameters dict
    allowed_query_string_parameters = ["MaxKeys", "ContinuationToken", "Delimiter"]
    for key in filter_dict_by_keys(query_string_parameters, allowed_query_string_parameters):
        query_parameters[key] = query_string_parameters[key]

    # convert MaxKeys to int if it exists
    if "MaxKeys" in query_parameters:
        # make sure MaxKeys is an int
        query_parameters["MaxKeys"] = int(query_parameters["MaxKeys"])

    s3_response = s3.list_objects_v2(**query_parameters)
    response = {}

    # copy over values with updated keys to response
    response["pageSize"] = s3_response["MaxKeys"]
    response["prefix"] = s3_response["Prefix"]
    response["bucket"] = env_variables[EnvVariable.DATA_BUCKET]

    if "NextContinuationToken" in s3_response:
        response["nextToken"] = s3_response["NextContinuationToken"]

    response["contents"] = []

    # add s3_response["Contents"] to the response
    if "Contents" in s3_response:
        response["contents"].extend(
            map(lambda content: {"key": content["Key"], "size": content["Size"], "type": "object"}, s3_response["Contents"])
        )

    # add s3_response["CommonPrefixes"] to the response
    if "CommonPrefixes" in s3_response:
        response["contents"].extend(
            map(lambda common_prefix: {"prefix": common_prefix["Prefix"], "type": "prefix"}, s3_response["CommonPrefixes"])
        )

    return response
