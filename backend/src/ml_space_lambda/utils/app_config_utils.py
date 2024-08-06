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

from cachetools import TTLCache, cached

from ml_space_lambda.data_access_objects.app_configuration import AppConfigurationDAO, AppConfigurationModel

app_configuration_dao = AppConfigurationDAO()


@cached(cache=TTLCache(maxsize=1, ttl=10))
def get_app_config() -> AppConfigurationModel:
    return AppConfigurationModel.from_dict(app_configuration_dao.get(configScope="global", num_versions=1)[0])


def get_emr_application_list() -> list:
    return [
        "Flink",
        "Ganglia",
        "HBase",
        "HCatalog",
        "Hadoop",
        "Hive",
        "Hue",
        "JupyterHub",
        "Livy",
        "MXNet",
        "Oozie",
        "Phoenix",
        "Presto",
        "Spark",
        "Tensorflow",
        "Tez",
        "Zeppelin",
        "Zookeeper",
    ]
