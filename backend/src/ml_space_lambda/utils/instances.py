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


def abbreviated_instance_intersection(superset: list[str], subset: list[str]) -> list[str]:
    # Finds the intersectinon of instances between superset and subset and returns an abbreviated list.
    #
    # If all instance types for a family (ie. "m4.") in superset are present in subset the resulting list
    # will be abbreviated with a single "m4.*" value instead of individual instance types for that family.

    abbreviated_instances = {}

    s1_compiled = {}
    for instance_type in superset:
        family_name = ".".join(instance_type.split(".")[:-1])
        family = s1_compiled.get(family_name, set())
        family.add(instance_type)
        s1_compiled[family_name] = family

    for instance_type in subset:
        family_name = ".".join(instance_type.split(".")[:-1])
        family = s1_compiled.get(family_name, set())

        if instance_type in family:
            family.remove(instance_type)

            if len(family) == 0:
                abbreviated_instances[family_name] = set([".".join([family_name, "*"])])
            else:
                family = abbreviated_instances.get(family_name, set())
                family.add(instance_type)
                abbreviated_instances[family_name] = family

    return [type for family_name in abbreviated_instances for type in abbreviated_instances[family_name]]


def kms_unsupported_instances() -> list[str]:
    # Returns a list of instance types that do not support using a KMS key to encrypt storage volumes.

    paginator = ec2.get_paginator("describe_instance_types")
    response_iterator = paginator.paginate(
        Filters=[{"Name": "hypervisor", "Values": ["nitro"]}, {"Name": "instance-storage-supported", "Values": ["true"]}]
    )

    return [
        instance_type["InstanceType"]
        for page in response_iterator
        for instance_type in page["InstanceTypes"]
        if not instance_type["InstanceType"].endswith(".metal")
    ]
