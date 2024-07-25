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

from ml_space_lambda.data_access_objects.group_user import GroupUserDAO
from ml_space_lambda.data_access_objects.project import ProjectDAO
from ml_space_lambda.data_access_objects.project_user import ProjectUserDAO

project_dao = ProjectDAO()
project_user_dao = ProjectUserDAO()
group_user_dao = GroupUserDAO()


def is_member_of_project(user_name: str, project_name: str, includeGroups: bool = True):
    if project_user_dao.get(project_name, user_name) is not None:
        return True

    if includeGroups:
        project = project_dao.get(project_name)
        if project is not None:
            for group_name in project.groups:
                if group_user_dao.get(group_name, user_name) is not None:
                    return True

    return False
