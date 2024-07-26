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
from ml_space_lambda.data_access_objects.project_user_group import ProjectUserGroupDAO
from ml_space_lambda.enums import Permission

project_dao = ProjectDAO()
project_user_dao = ProjectUserDAO()
group_user_dao = GroupUserDAO()
project_user_group_dao = ProjectUserGroupDAO()


def is_owner_of_project(username: str, project_name: str) -> bool:
    """Check if a user is an owner of a project.

    Args:
        username (str): The username of the user
        project_name (str): The project name

    Returns:
        bool: True if the user is an owner, otherwise False
    """

    # check if user has direct membership
    project_user = project_user_dao.get(project_name, username)
    if Permission.PROJECT_OWNER in project_user.permissions:
        return True

    # check if user has indirect membership through a group
    for project_user_group in project_user_group_dao.get_for_project_user(project_name, username):
        if Permission.PROJECT_OWNER in project_user_group.permissions:
            return True

    return False


def is_member_of_project(username: str, project_name: str) -> bool:
    """Check if a user is a member of a project either directly or indirectrly through a group.

    Args:
        username (str): The username of the user
        project_name (str): The project name

    Returns:
        bool: True if the user is a member, otherwise False
    """

    # check if user has direct membership
    if project_user_dao.get(project_name, username):
        return True

    # check if user has indirect membership through a group
    if len(project_user_group_dao.get_for_project_user(project_name, username, 1)) > 0:
        return True

    return False
