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

import boto3

from ml_space_lambda.data_access_objects.project import ProjectDAO
from ml_space_lambda.data_access_objects.resource_scheduler import ResourceSchedulerDAO, ResourceSchedulerModel
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import api_wrapper, generate_tags, list_clusters_for_project, retry_config
from ml_space_lambda.utils.mlspace_config import get_environment_variables, pull_config_from_s3

logger = logging.getLogger(__name__)

s3 = boto3.client("s3", config=retry_config)
emr = boto3.client("emr", config=retry_config)

cluster_config = {}

resource_scheduler_dao = ResourceSchedulerDAO()
project_dao = ProjectDAO()


@api_wrapper
def create(event, context):
    project_name = event["pathParameters"]["projectName"]
    user_name = event["requestContext"]["authorizer"]["principalId"]
    event_body = json.loads(event["body"])
    cluster_name = event_body["clusterName"]
    # Don't change without also changing navigation path in MLSpaceFrontEnd emr-cluster-create.tsx
    full_cluster_name = f"{project_name}-{cluster_name}"
    emr_size = event_body["options"]["emrSize"]
    release_version = event_body["options"]["emrRelease"]

    env_variables = get_environment_variables()

    custom_ami_id = event_body["options"]["customAmiId"] if "customAmiId" in event_body["options"] else None
    applications = []

    global cluster_config
    if not cluster_config:
        resp = s3.get_object(Bucket=env_variables["BUCKET"], Key=env_variables["CLUSTER_CONFIG_KEY"])
        cluster_config = json.loads(resp["Body"].read().decode())

    # get list of applications if provided, otherwise use default from
    # s3 cluster config
    if event_body.get("options", {}).get("applications", []):
        application_list = event_body["options"]["applications"]
        for app in application_list:
            app_name = {"Name": app}
            applications.append(app_name)
    else:
        applications = cluster_config["applications"]

    # use subnet if provided, otherwise choose a random subnet
    # from s3 config file
    subnet = event_body.get("Instances", {}).get("Ec2SubnetId", None)
    if not subnet:
        param_file = pull_config_from_s3()
        subnet = random.sample(param_file["pSMSSubnetIds"].split(","), 1)[0]

    # Get Custom EC2 Key Pair
    ec2_key_name = ""
    if cluster_config["ec2-key"] != "EC2_KEY":
        ec2_key_name = cluster_config["ec2-key"]

    master_instance_type = cluster_config[emr_size]["master-type"]
    core_instance_type = cluster_config[emr_size]["core-type"]
    instance_count = cluster_config[emr_size]["size"]

    args = {}
    args["Name"] = full_cluster_name
    args["LogUri"] = f"s3://{env_variables['LOG_BUCKET']}"
    args["ReleaseLabel"] = release_version
    args["Applications"] = applications
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
                        "MinCapacity": cluster_config["auto-scaling"]["min-instances"],
                        "MaxCapacity": cluster_config["auto-scaling"]["max-instances"],
                    },
                    "Rules": [
                        {
                            "Name": "AutoScalingPolicyUp",
                            "Description": "Scaling policy configured in the cluster-config.json",
                            "Action": {
                                "SimpleScalingPolicyConfiguration": {
                                    "ScalingAdjustment": cluster_config["auto-scaling"]["scale-out"]["increment"],
                                    "CoolDown": cluster_config["auto-scaling"]["scale-out"]["cooldown"],
                                }
                            },
                            "Trigger": {
                                "CloudWatchAlarmDefinition": {
                                    "ComparisonOperator": "LESS_THAN",
                                    "EvaluationPeriods": cluster_config["auto-scaling"]["scale-out"]["eval-periods"],
                                    "MetricName": "YARNMemoryAvailablePercentage",
                                    "Period": 300,
                                    "Threshold": cluster_config["auto-scaling"]["scale-out"]["percentage-mem-available"],
                                    "Unit": "PERCENT",
                                }
                            },
                        },
                        {
                            "Name": "AutoScalingPolicyDown",
                            "Description": "Scaling policy configured in the cluster-config.json",
                            "Action": {
                                "SimpleScalingPolicyConfiguration": {
                                    "ScalingAdjustment": cluster_config["auto-scaling"]["scale-in"]["increment"],
                                    "CoolDown": cluster_config["auto-scaling"]["scale-in"]["cooldown"],
                                }
                            },
                            "Trigger": {
                                "CloudWatchAlarmDefinition": {
                                    "ComparisonOperator": "GREATER_THAN",
                                    "EvaluationPeriods": cluster_config["auto-scaling"]["scale-in"]["eval-periods"],
                                    "MetricName": "YARNMemoryAvailablePercentage",
                                    "Period": 300,
                                    "Threshold": cluster_config["auto-scaling"]["scale-in"]["percentage-mem-available"],
                                    "Unit": "PERCENT",
                                }
                            },
                        },
                    ],
                },
            },
        ],
        "Ec2KeyName": ec2_key_name,
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

        clusters = list_clusters_for_project(
            emr=emr,
            prefix=project_name,
            fetch_all=True,
            created_after=datetime.datetime.fromtimestamp(time.time() - 20),
        )

        for cluster in clusters["records"]:
            if cluster["Name"] == full_cluster_name:
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


@api_wrapper
def list_all(event, context):
    # TODO: get the cluster from the resource table. query_resource_metadata()
    project_name = event["pathParameters"]["projectName"]

    return list_clusters_for_project(
        emr,
        project_name,
        paging_options=event["queryStringParameters"] if "queryStringParameters" in event else None,
    )


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
