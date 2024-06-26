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

from ml_space_lambda.utils.mlspace_config import retry_config

ec2 = boto3.client("ec2", config=retry_config)


def nitro_abbreviated_union(sagemaker_instances: dict[str, set[str]], prefix: str = None) -> list[str]:
    abbreviated_instancers = {}
    for instance_type in nitro_instances():
        full_name = instance_type
        components = full_name.split(".")
        family_name = components[0]

        if prefix is not None:
            full_name = ".".join([prefix, *components])
            family_name = ".".join([prefix, components[0]])

        family = sagemaker_instances.get(family_name, set())
        if full_name in family:
            family.remove(full_name)

            if len(family) == 0:
                abbreviated_instancers[family_name] = set([".".join([family_name, "*"])])
            else:
                family = abbreviated_instancers.get(family_name, set())
                family.add(full_name)
                abbreviated_instancers[family_name] = family

    return [type for family_name in abbreviated_instancers for type in abbreviated_instancers[family_name]]


def nitro_instances() -> list[str]:
    paginator = ec2.get_paginator("describe_instance_types")
    response_iterator = paginator.paginate(
        Filters=[{"Name": "hypervisor", "Values": ["nitro"]}, {"Name": "instance-storage-supported", "Values": ["true"]}]
    )

    return [instance_type["InstanceType"] for page in response_iterator for instance_type in page["InstanceTypes"]]
