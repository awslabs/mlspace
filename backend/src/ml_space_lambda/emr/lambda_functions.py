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

import datetime
import json
import logging
import random
import time
from typing import Any, Dict, Optional

import boto3

from ml_space_lambda.data_access_objects.project import ProjectDAO
from ml_space_lambda.data_access_objects.resource_metadata import ResourceMetadataDAO
from ml_space_lambda.data_access_objects.resource_scheduler import ResourceSchedulerDAO, ResourceSchedulerModel
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.app_config_utils import get_app_config, get_emr_application_list
from ml_space_lambda.utils.common_functions import api_wrapper, generate_tags, query_resource_metadata, retry_config
from ml_space_lambda.utils.mlspace_config import get_environment_variables, pull_config_from_s3

logger = logging.getLogger(__name__)

emr = boto3.client("emr", config=retry_config)

resource_metadata_dao = ResourceMetadataDAO()

resource_scheduler_dao = ResourceSchedulerDAO()
project_dao = ProjectDAO()


@api_wrapper
def create(event, context):
    project_name = event["pathParameters"]["projectName"]
    user_name = event["requestContext"]["authorizer"]["principalId"]
    event_body = json.loads(event["body"])
    cluster_name = event_body["clusterName"]
    emr_size = event_body["options"]["emrSize"]
    release_version = event_body["options"]["emrRelease"]
    app_config = get_app_config()

    env_variables = get_environment_variables()

    custom_ami_id = event_body["options"]["customAmiId"] if "customAmiId" in event_body["options"] else None

    # use subnet if provided, otherwise choose a random subnet
    # from s3 config file
    subnet = event_body.get("Instances", {}).get("Ec2SubnetId", None)
    if not subnet:
        param_file = pull_config_from_s3()
        subnet = random.sample(param_file["pSMSSubnetIds"].split(","), 1)[0]

    for size in app_config.configuration.emr_config.cluster_types:
        if size.name == emr_size:
            master_instance_type = size.master_type
            core_instance_type = size.core_type
            instance_count = size.size

    args = {}
    args["Name"] = cluster_name
    args["LogUri"] = f"s3://{env_variables['LOG_BUCKET']}"
    args["ReleaseLabel"] = release_version
    args["Applications"] = app_config.configuration.emr_config.to_dict()["applications"]
    args["Instances"] = {
        "InstanceGroups": [
            {
                "Name": "Master",
                "Market": "ON_DEMAND",
                "InstanceRole": "MASTER",
                "InstanceType": master_instance_type,
                "InstanceCount": 1,
            },
            {
                "Name": "Worker",
                "Market": "ON_DEMAND",
                "InstanceRole": "CORE",
                "InstanceType": core_instance_type,
                "InstanceCount": instance_count,
                "AutoScalingPolicy": {
                    "Constraints": {
                        "MinCapacity": app_config.configuration.emr_config.auto_scaling.min_instances,
                        "MaxCapacity": app_config.configuration.emr_config.auto_scaling.max_instances,
                    },
                    "Rules": [
                        {
                            "Name": "AutoScalingPolicyUp",
                            "Description": "Scaling policy configured in the dynamic config",
                            "Action": {
                                "SimpleScalingPolicyConfiguration": {
                                    "ScalingAdjustment": app_config.configuration.emr_config.auto_scaling.scale_out.increment,
                                    "CoolDown": app_config.configuration.emr_config.auto_scaling.scale_out.cooldown,
                                }
                            },
                            "Trigger": {
                                "CloudWatchAlarmDefinition": {
                                    "ComparisonOperator": "LESS_THAN",
                                    "EvaluationPeriods": app_config.configuration.emr_config.auto_scaling.scale_out.eval_periods,
                                    "MetricName": "YARNMemoryAvailablePercentage",
                                    "Period": 300,
                                    "Threshold": app_config.configuration.emr_config.auto_scaling.scale_out.percentage_mem_available,
                                    "Unit": "PERCENT",
                                }
                            },
                        },
                        {
                            "Name": "AutoScalingPolicyDown",
                            "Description": "Scaling policy configured in the dynamic config",
                            "Action": {
                                "SimpleScalingPolicyConfiguration": {
                                    "ScalingAdjustment": app_config.configuration.emr_config.auto_scaling.scale_in.increment,
                                    "CoolDown": app_config.configuration.emr_config.auto_scaling.scale_in.cooldown,
                                }
                            },
                            "Trigger": {
                                "CloudWatchAlarmDefinition": {
                                    "ComparisonOperator": "GREATER_THAN",
                                    "EvaluationPeriods": app_config.configuration.emr_config.auto_scaling.scale_in.eval_periods,
                                    "MetricName": "YARNMemoryAvailablePercentage",
                                    "Period": 300,
                                    "Threshold": app_config.configuration.emr_config.auto_scaling.scale_in.percentage_mem_available,
                                    "Unit": "PERCENT",
                                }
                            },
                        },
                    ],
                },
            },
        ],
        "Ec2KeyName": env_variables["EMR_EC2_SSH_KEY"],
        "KeepJobFlowAliveWhenNoSteps": True,
        "TerminationProtected": False,
        "Ec2SubnetId": subnet,
    }

    # If the request specified a custom ami id, configure the instance groups to use that ami
    if custom_ami_id:
        for instance_group in args["Instances"]["InstanceGroups"]:
            instance_group["CustomAmiId"] = custom_ami_id

    args["VisibleToAllUsers"] = True
    args["JobFlowRole"] = env_variables["EMR_EC2_ROLE_NAME"]
    args["ServiceRole"] = env_variables["EMR_SERVICE_ROLE_NAME"]
    args["AutoScalingRole"] = env_variables["EMR_EC2_ROLE_NAME"]
    args["Tags"] = generate_tags(user_name, project_name, env_variables["SYSTEM_TAG"])

    # Use a security configuration to disable IMDSv1
    args["SecurityConfiguration"] = env_variables["EMR_SECURITY_CONFIGURATION"]

    response = emr.run_job_flow(**args)
    project = project_dao.get(project_name)
    if (
        project.metadata
        and project.metadata["terminationConfiguration"]
        and "defaultEMRClusterTTL" in project.metadata["terminationConfiguration"]
    ):
        # Endpoint TTL is in hours so we need to convert that to seconds and add to the current time
        termination_time = time.time() + (int(project.metadata["terminationConfiguration"]["defaultEMRClusterTTL"]) * 60 * 60)

        clusters = _list_all_clusters_created_after_date(
            created_after=datetime.datetime.fromtimestamp(time.time() - 20),
        )
        for cluster in clusters["records"]:
            if cluster["Name"] == cluster_name:
                resource_scheduler_dao.create(
                    ResourceSchedulerModel(
                        resource_id=cluster["Id"],
                        resource_type=ResourceType.EMR_CLUSTER,
                        termination_time=termination_time,
                        project=project_name,
                    )
                )
                break

    return response


def _list_all_clusters_created_after_date(
    created_after: datetime.datetime,
    paging_options: Optional[Dict[str, str]] = None,
):
    list_of_clusters = []
    kwargs: Dict[str, Any] = {}
    result: Dict[str, Any] = {
        "records": [],
    }
    if paging_options and "resourceStatus" in paging_options:
        kwargs["ClusterStates"] = [paging_options["resourceStatus"]]
    else:
        kwargs["ClusterStates"] = [
            "STARTING",
            "BOOTSTRAPPING",
            "RUNNING",
            "WAITING",
        ]

    if created_after:
        kwargs["CreatedAfter"] = created_after

    paginator = emr.get_paginator("list_clusters")
    pages = paginator.paginate(**kwargs)

    for page in pages:
        if "Clusters" in page:
            for cluster in page["Clusters"]:
                list_of_clusters.append(cluster)

    result["records"] = list_of_clusters
    return result


@api_wrapper
def list_all(event, context):
    return query_resource_metadata(resource_metadata_dao, event, ResourceType.EMR_CLUSTER)


@api_wrapper
def list_applications(event, context):
    # EMR doesn't seem to have an API for listing the applications available for a specific release label.
    # If you describe a release label you can get the applications it supports, but we just want to display
    # a list of all applications supported for every 6.X release labels
    return get_emr_application_list()


@api_wrapper
def list_release_labels(event, context):
    response = emr.list_release_labels(
        Filters={
            "Prefix": "emr-6",
        }
    )
    return {"ReleaseLabels": response["ReleaseLabels"]}


@api_wrapper
def get(event, context):
    cluster_id = event["pathParameters"]["clusterId"]
    response = emr.describe_cluster(ClusterId=cluster_id)

    # Add termination time metadata to response
    scheduler_model = resource_scheduler_dao.get(resource_id=cluster_id, resource_type=ResourceType.EMR_CLUSTER)
    if scheduler_model and scheduler_model.termination_time:
        response["TerminationTime"] = scheduler_model.termination_time

    for tag in response["Cluster"]["Tags"]:
        if tag["Key"] == "user":
            response["Owner"] = tag["Value"]
            break

    return response


@api_wrapper
def delete(event, context):
    cluster_id = event["pathParameters"]["clusterId"]

    emr.set_termination_protection(JobFlowIds=[cluster_id], TerminationProtected=False)

    # If successful, returns 200 with empty body
    emr.terminate_job_flows(JobFlowIds=[cluster_id])

    resource_scheduler_dao.delete(resource_id=cluster_id, resource_type=ResourceType.EMR_CLUSTER)

    return f"Successfully terminated {cluster_id}"


@api_wrapper
def remove(event, context):
    cluster_id = event["pathParameters"]["clusterId"]
    resource_metadata_dao.delete(cluster_id, ResourceType.EMR_CLUSTER)

    return f"Successfully removed {cluster_id}"
