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

import base64
import json
import logging
import random
import re
import urllib.parse

import boto3
from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.project import ProjectDAO
from ml_space_lambda.data_access_objects.project_user import ProjectUserDAO
from ml_space_lambda.data_access_objects.resource_metadata import ResourceMetadataDAO
from ml_space_lambda.data_access_objects.resource_scheduler import (
    ResourceSchedulerDAO,
    ResourceSchedulerModel,
)
from ml_space_lambda.data_access_objects.user import UserModel
from ml_space_lambda.enums import Permission, ResourceType
from ml_space_lambda.utils.common_functions import (
    api_wrapper,
    generate_tags,
    get_notebook_stop_time,
    get_tags_for_resource,
    retry_config,
)
from ml_space_lambda.utils.mlspace_config import get_environment_variables, pull_config_from_s3

logger = logging.getLogger(__name__)

emr = boto3.client("emr", config=retry_config)
sagemaker = boto3.client("sagemaker", config=retry_config)
ec2 = boto3.client("ec2", config=retry_config)
project_user_dao = ProjectUserDAO()
project_dao = ProjectDAO()
resource_scheduler_dao = ResourceSchedulerDAO()
resource_metadata_dao = ResourceMetadataDAO()

input_validation = re.compile(r"[^a-zA-Z0-9]")


@api_wrapper
def create(event, context):
    user_name = event["requestContext"]["authorizer"]["principalId"]
    request = json.loads(event["body"])
    proj_name = request["ProjectName"]
    inst_name = request["NotebookInstanceName"]
    inst_type = request["InstanceType"]
    size = int(request["VolumeSizeInGB"])
    lifecycle_config = request.get("NotebookInstanceLifecycleConfigName")

    project_name_from_header = event["headers"]["x-mlspace-project"]
    if project_name_from_header != proj_name:
        raise Exception(
            f"Project header, {project_name_from_header}, does not match the project name associated with the notebook, {proj_name}."
        )

    param_file = pull_config_from_s3()
    env_variables = get_environment_variables()

    # IAM role to be used when creating the instance depends on the deployment type/customer
    iam_role = param_file["pSMSRoleARN"]
    if env_variables["MANAGE_IAM_ROLES"]:
        project_user = project_user_dao.get(proj_name, user_name)
        iam_role = project_user.role

    # Pick a random subnet for deployment if one isn't in the input
    subnet = ""
    if "subnetId" in request:
        subnet = request["subnetId"]
    else:
        subnet = random.choice(param_file["pSMSSubnetIds"].split(","))

    tags_list = generate_tags(user_name, proj_name, env_variables["SYSTEM_TAG"])

    # If the user did not select a lifecycle config, do not request one.
    if not lifecycle_config or lifecycle_config.lower() == "no configuration":
        lifecycle_config = param_file["pSMSLifecycleConfigName"]

    # If attaching to a cluster ensure the necessary lifcycle config exists and we're creating on the correct subnet
    if "clusterId" in request:
        cluster_id = request["clusterId"]
        cluster_info = emr.describe_cluster(ClusterId=cluster_id)
        master_info = _get_emr_master_info(cluster_id)
        subnet = master_info["subnet"]
        lifecycle_config = _get_and_ensure_emr_lifecycle_config(
            cluster_info, master_info, param_file
        )

    response = sagemaker.create_notebook_instance(
        NotebookInstanceName=inst_name,
        InstanceType=inst_type,
        SubnetId=subnet,
        SecurityGroupIds=param_file["pSMSSecurityGroupId"],
        RoleArn=iam_role,
        KmsKeyId=param_file["pSMSKMSKeyId"],
        Tags=tags_list,
        LifecycleConfigName=lifecycle_config,
        DirectInternetAccess="Disabled",
        VolumeSizeInGB=size,
        RootAccess="Disabled",
    )

    project = project_dao.get(proj_name)

    # Check for a notebook stop time
    if (
        project
        and project.metadata
        and project.metadata["terminationConfiguration"]
        and "defaultNotebookStopTime" in project.metadata["terminationConfiguration"]
    ):
        if (
            "allowNotebookOwnerOverride" in project.metadata["terminationConfiguration"]
            and "NotebookDailyStopTime" in request
        ):
            daily_stop_time = get_notebook_stop_time(request.get("NotebookDailyStopTime"))
        else:
            daily_stop_time = get_notebook_stop_time(
                project.metadata["terminationConfiguration"]["defaultNotebookStopTime"]
            )

        # If daily_stop_time is None / "" don't schedule termination
        if daily_stop_time:
            resource_scheduler_dao.create(
                ResourceSchedulerModel(
                    resource_id=inst_name,
                    resource_type=ResourceType.NOTEBOOK,
                    termination_time=daily_stop_time,
                    project=proj_name,
                )
            )

    # Create the record in the resource_metadata table
    resource_metadata_dao.upsert_record(
        inst_name, ResourceType.NOTEBOOK, user_name, project.name, {}
    )

    return response


@api_wrapper
def delete(event, context):
    inst_name = event["pathParameters"]["notebookName"]

    response = sagemaker.delete_notebook_instance(NotebookInstanceName=inst_name)

    resource_scheduler_dao.delete(resource_id=inst_name, resource_type=ResourceType.NOTEBOOK)

    return response


@api_wrapper
def describe(event, context):
    notebook_name = urllib.parse.unquote(event["pathParameters"]["notebookName"])
    response = sagemaker.describe_notebook_instance(NotebookInstanceName=notebook_name)
    tags = get_tags_for_resource(sagemaker, response["NotebookInstanceArn"])

    # Add termination time metadata to response
    scheduler_model = resource_scheduler_dao.get(
        resource_id=notebook_name, resource_type=ResourceType.NOTEBOOK
    )
    if scheduler_model and scheduler_model.termination_time:
        response["NotebookDailyStopTime"] = scheduler_model.termination_time

    for tag in tags:
        if tag["Key"] == "user":
            response["Owner"] = tag["Value"]
        if tag["Key"] == "project":
            response["Project"] = tag["Value"]

    return response


@api_wrapper
def edit(event, context):
    param_file = pull_config_from_s3()
    event_body = json.loads(event["body"])
    lifecycle_config = (
        event_body["NotebookInstanceLifecycleConfigName"]
        if "NotebookInstanceLifecycleConfigName" in event_body
        else None
    )
    if "clusterId" in event_body:
        cluster_id = event_body["clusterId"]
        cluster_info = emr.describe_cluster(ClusterId=cluster_id)
        master_info = _get_emr_master_info(cluster_id)
        lifecycle_config = _get_and_ensure_emr_lifecycle_config(
            cluster_info, master_info, param_file
        )

    if not lifecycle_config or lifecycle_config.lower() == "no configuration":
        lifecycle_config = param_file["pSMSLifecycleConfigName"]

    args = {}
    args["NotebookInstanceName"] = event_body["NotebookInstanceName"]
    args["InstanceType"] = event_body["InstanceType"]
    args["LifecycleConfigName"] = lifecycle_config
    args["VolumeSizeInGB"] = event_body["VolumeSizeInGB"]

    if "NotebookDailyStopTime" in event_body:
        project_name = event["requestContext"]["authorizer"]["projectName"]
        project = project_dao.get(project_name)
        if (
            project
            and project.metadata
            and project.metadata["terminationConfiguration"]
            and "allowNotebookOwnerOverride" in project.metadata["terminationConfiguration"]
        ):
            if event_body["NotebookDailyStopTime"] == "":
                resource_scheduler_dao.delete(
                    resource_id=event_body["NotebookInstanceName"],
                    resource_type=ResourceType.NOTEBOOK,
                )
            else:
                resource_scheduler_dao.update_termination_time(
                    resource_id=event_body["NotebookInstanceName"],
                    resource_type=ResourceType.NOTEBOOK,
                    new_termination_time=get_notebook_stop_time(
                        event_body.get("NotebookDailyStopTime")
                    ),
                    project=project.name,
                )
        else:
            raise Exception("Not allowed to edit notebook termination time for this project.")

    return sagemaker.update_notebook_instance(**args)


@api_wrapper
def list_resources(event, context):
    user = UserModel.from_dict(json.loads(event["requestContext"]["authorizer"]["user"]))
    limit = 100
    next_token = None

    if "queryStringParameters" in event and event["queryStringParameters"]:
        if "nextToken" in event["queryStringParameters"]:
            next_token = event["queryStringParameters"]["nextToken"]
        if "pageSize" in event["queryStringParameters"]:
            limit = int(event["queryStringParameters"]["pageSize"])
    response = {"records": []}
    if event["pathParameters"] and "projectName" in event["pathParameters"]:
        project_name = event["pathParameters"]["projectName"]
        notebooks_metadata = resource_metadata_dao.get_all_for_project_by_type(
            project_name, ResourceType.NOTEBOOK, limit=limit, next_token=next_token
        )
        if notebooks_metadata.next_token:
            response["nextToken"] = notebooks_metadata.next_token
        # Filter out notebooks that aren't owned by the requesting user unless they are
        # an admin or project owner
        project_user = project_user_dao.get(project_name, user.username)

        if (
            Permission.ADMIN not in user.permissions
            and project_user
            and Permission.PROJECT_OWNER not in project_user.permissions
        ):
            response["records"] = [
                record.to_dict()
                for record in notebooks_metadata.records
                if record.user == user.username
            ]
        else:
            response["records"] = [record.to_dict() for record in notebooks_metadata.records]
    else:
        notebooks_metadata = resource_metadata_dao.get_all_for_user_by_type(
            user.username, ResourceType.NOTEBOOK, limit=limit, next_token=next_token
        )
        if notebooks_metadata.next_token:
            response["nextToken"] = notebooks_metadata.next_token

        projects = project_user_dao.get_projects_for_user(user.username)
        project_names = [project_user.project for project_user in projects]
        # Need to filter out any notebook records that are associated with a project the user
        # no longer belongs to (even if the user was the creator/owner)
        response["records"] = [
            record.to_dict()
            for record in notebooks_metadata.records
            if record.project in project_names
        ]

    return response


@api_wrapper
def presigned_url(event, context):
    inst_name = event["pathParameters"]["notebookName"]
    return sagemaker.create_presigned_notebook_instance_url(NotebookInstanceName=inst_name)


@api_wrapper
def start(event, context):
    inst_name = event["pathParameters"]["notebookName"]

    return sagemaker.start_notebook_instance(NotebookInstanceName=inst_name)


@api_wrapper
def stop(event, context):
    inst_name = event["pathParameters"]["notebookName"]
    return sagemaker.stop_notebook_instance(NotebookInstanceName=inst_name)


def _ensure_config(config_name: str, master_info: dict):
    try:
        sagemaker.describe_notebook_instance_lifecycle_config(
            NotebookInstanceLifecycleConfigName=config_name
        )
    except Exception:
        sagemaker.create_notebook_instance_lifecycle_config(
            NotebookInstanceLifecycleConfigName=config_name,
            OnStart=[{"Content": _render_emr_script(master_info["ip"])}],
        )


def _get_and_ensure_emr_lifecycle_config(cluster_info, master_info, param_file):
    _update_cluster_sg(
        cluster_info["Cluster"]["Ec2InstanceAttributes"]["EmrManagedMasterSecurityGroup"],
        param_file["pSMSSecurityGroupId"][0],
    )
    cluster_name = cluster_info["Cluster"]["Name"]
    lifecycle_config = f"{cluster_name}-int-mls-conf"
    _ensure_config(lifecycle_config, master_info)
    return lifecycle_config


def _get_emr_master_info(cluster_id: str) -> dict:
    # Get ip/subnet details for EMR master node
    emr_list_instance = emr.list_instances(ClusterId=cluster_id, InstanceGroupTypes=["MASTER"])
    master_instance_id = emr_list_instance["Instances"][0]["Ec2InstanceId"]
    master_instance_ip = emr_list_instance["Instances"][0]["PrivateIpAddress"]

    ec2_describe_instances = ec2.describe_instances(InstanceIds=[master_instance_id])
    master_subnet_id = ec2_describe_instances["Reservations"][0]["Instances"][0]["SubnetId"]

    return {"ip": master_instance_ip, "subnet": master_subnet_id}


def _update_cluster_sg(cluster_security_group_id: str, notebook_security_group_id: str):
    # Updates EMR Cluster security group to allow ingress from notebook security group for 8998/tcp
    try:
        ec2.authorize_security_group_ingress(
            GroupId=cluster_security_group_id,
            IpPermissions=[
                {
                    "IpProtocol": "tcp",
                    "FromPort": 8998,
                    "ToPort": 8998,
                    "UserIdGroupPairs": [{"GroupId": notebook_security_group_id}],
                }
            ],
        )
    except ClientError as e:
        # it isn't a problem if the rule already exists
        if e.response["Error"]["Code"] == "InvalidPermission.Duplicate":
            pass
        else:
            raise e


def _render_emr_script(emr_master_ip: str) -> str:
    env_variables = get_environment_variables()
    emr_script = f"""
    #!/bin/bash
    set -x

    # OVERVIEW
    # This script connects an EMR Cluster to the Notebook Instance using SparkMagic.
    #
    # Note that this script will fail if the EMR Cluster's master node IP address not reachable
    #   1. Ensure that the EMR master node IP is resolvable from the Notebook Instance.
    #       - One way to accomplish this is having the Notebook Instance and the EMR Cluster in the same subnet
    #   2. Ensure the EMR master node Security Groups provides inbound access from the Notebook Instance Security Group
    #       Type        - Protocol - Port - Source
    #       Custom TCP  - TCP      - 8998 - $NOTEBOOK_SECURITY_GROUP
    #   3. Ensure the Notebook Instance has internet connectivity to fetch the SparkMagic example config
    #
    # https://aws.amazon.com/blogs/machine-learning/build-amazon-sagemaker-notebooks-backed-by-spark-in-amazon-emr/

    # PARAMETERS
    EMR_MASTER_IP={emr_master_ip}
    S3_CONFIG_BUCKET={env_variables["BUCKET"]}

    cd /home/ec2-user/.sparkmagic

    echo "Fetching SparkMagic example config from GitHub.."
    aws s3 cp s3://$S3_CONFIG_BUCKET/sparkmagic_config.json .

    echo "Replacing EMR master node IP in SparkMagic config..."
    sed -i -- "s/localhost/$EMR_MASTER_IP/g" sparkmagic_config.json
    mv sparkmagic_config.json config.json
    # echo "Sending a sample request to Livy.."
    # curl "$EMR_MASTER_IP:8998/sessions"

    # Use the AWS S3 sync command to retrieve global resources
    aws s3 sync s3://{env_variables["DATA_BUCKET"]}/global-read-only/resources /home/ec2-user/SageMaker/global-resources/
    echo "Global resources downloaded and stored in /home/ec2-user/SageMaker/global-resources/ which includes notebook parameters and an example notebook for high-side repo access instructions."
    """

    b64_encoded = base64.b64encode(emr_script.encode())
    return b64_encoded.decode("ascii")
