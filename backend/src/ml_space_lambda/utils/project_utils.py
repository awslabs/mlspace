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
from ml_space_lambda.data_access_objects.project_group import ProjectGroupDAO
from ml_space_lambda.data_access_objects.project_user import ProjectUserDAO
from ml_space_lambda.enums import Permission

project_dao = ProjectDAO()
project_user_dao = ProjectUserDAO()
group_user_dao = GroupUserDAO()
project_group_dao = ProjectGroupDAO()


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
    user_groups = [group_user.group for group_user in group_user_dao.get_groups_for_user(username)]
    project_groups = [
        project_group.group_name
        for project_group in project_group_dao.get_groups_for_project(project_name)
        if Permission.PROJECT_OWNER in project_group.permissions
    ]
    if len(set(user_groups) & set(project_groups)) > 0:
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
    user_groups = [group_user.group for group_user in group_user_dao.get_groups_for_user(username)]
    project_groups = [project_group.group_name for project_group in project_group_dao.get_groups_for_project(project_name)]
    if len(set(user_groups) & set(project_groups)) > 0:
        return True

    return False
