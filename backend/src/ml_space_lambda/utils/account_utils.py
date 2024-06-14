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


# Structure of a context: https://docs.aws.amazon.com/lambda/latest/dg/python-context.html
def account_arn_from_context(lambda_context, service, resource, omit_region=False):
    return account_arn_from_example_arn(lambda_context.invoked_function_arn, service, resource, omit_region=omit_region)


def account_arn_from_example_arn(example_arn, service, resource, omit_region=False):
    components = example_arn.split(":")
    partition = components[1]
    region = components[3] if not omit_region else ""
    account_id = components[4]

    return f"arn:{partition}:{service}:{region}:{account_id}:{resource}"
