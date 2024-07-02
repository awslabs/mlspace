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

import json
import time
import urllib.parse
from typing import List, Optional

from ml_space_lambda.data_access_objects.project_user import ProjectUserDAO
from ml_space_lambda.data_access_objects.user import TIMEZONE_PREFERENCE_KEY, UserDAO, UserModel
from ml_space_lambda.enums import EnvVariable, Permission, TimezonePreference
from ml_space_lambda.utils.common_functions import api_wrapper, serialize_permissions, total_project_owners
from ml_space_lambda.utils.exceptions import ResourceNotFound
from ml_space_lambda.utils.iam_manager import IAMManager
from ml_space_lambda.utils.mlspace_config import get_environment_variables

project_user_dao = ProjectUserDAO()
user_dao = UserDAO()
iam_manager = IAMManager()


@api_wrapper
def create(event, context):
    entity = json.loads(event["body"])
    username = entity["username"]
    suspended_state = get_environment_variables().get("NEW_USER_SUSPENSION_DEFAULT") == "True"
    preferences = {TIMEZONE_PREFERENCE_KEY: TimezonePreference.LOCAL}

    existing_user = user_dao.get(username)
    if existing_user:
        raise ValueError("Username in use.")

    new_user = UserModel(
        username=username,
        email=entity["email"],
        display_name=entity["name"],
        suspended=suspended_state,
        preferences=preferences,
    )
    user_dao.create(new_user)

    return new_user.to_dict()


@api_wrapper
def delete(event, context):
    username = urllib.parse.unquote(event["pathParameters"]["username"])

    user = user_dao.get(username)
    if not user:
        raise ResourceNotFound("Specified user does not exist.")

    projects = _sole_project_owner(username)

    if projects:
        raise Exception(
            f"User is the only owner of the following projects: {', '.join(projects)}. "
            "Please assign an additional owner before deleting the user."
        )

    # If user is not the sole owner of any projects, we get here and delete the user's
    # project records from the ddb table
    project_list = project_user_dao.get_projects_for_user(username)
    env_variables = get_environment_variables()
    for project in project_list:
        project_user_dao.delete(username, project.project)

    if project_list and env_variables[EnvVariable.MANAGE_IAM_ROLES]:
        iam_manager.remove_all_user_roles(username, [project.project for project in project_list])

    user_dao.delete(username)

    return f"User {username} deleted"


@api_wrapper
def current(event, context):
    username = event["requestContext"]["authorizer"]["principalId"]
    user = user_dao.get(username)
    if not user:
        raise ValueError("Unable to retrieve user details.")
    return user.to_dict()


@api_wrapper
def update(event, context):
    username = urllib.parse.unquote(event["pathParameters"]["username"])
    updates = json.loads(event["body"])
    suspended: Optional[bool] = updates.get("suspended", None)
    permissions: List[str] = updates.get("permissions", [])
    preferences: dict = updates.get("preferences", {})

    invoking_user = UserModel.from_dict(json.loads(event["requestContext"]["authorizer"]["user"]))
    update_user = False
    existing_user = user_dao.get(username)

    # Ensure that only admins can mutate suspension status and permissions
    if Permission.ADMIN in invoking_user.permissions:
        if not existing_user:
            raise ResourceNotFound("Specified user does not exist.")
        if suspended and not existing_user.suspended:
            projects = _sole_project_owner(username)
            if projects:
                raise Exception(f"User is last MO on the following projects: {', '.join(projects)}")
            existing_user.suspended = True
            update_user = True
        if suspended is False and existing_user.suspended:
            existing_user.suspended = False
            update_user = True
        if sorted(serialize_permissions(existing_user.permissions)) != sorted(permissions):
            existing_user.permissions = [Permission(entry) for entry in permissions]
            update_user = True
    if preferences and preferences is not existing_user.preferences:
        existing_user.preferences = preferences
        update_user = True

    if update_user:
        user_dao.update(username, existing_user)
    return updates


@api_wrapper
def login(event, context):
    username = event["requestContext"]["authorizer"]["principalId"]
    existing_user = user_dao.get(username)
    if not existing_user:
        raise ResourceNotFound("Specified user does not exist.")
    existing_user.last_login = int(time.time())
    user_dao.update(username, existing_user)
    return existing_user.to_dict()


@api_wrapper
def list_all(event, context):
    # If user is an Admin list every user else don't include suspended users
    users = user_dao.get_all(include_suspended=True)
    return [user.to_dict() for user in users]


def _sole_project_owner(user_name: str) -> List[str]:
    project_list = project_user_dao.get_projects_for_user(user_name)
    projects = []
    for project in project_list:
        project_name = project.to_dict()["project"]
        if Permission.PROJECT_OWNER in project.permissions and total_project_owners(project_user_dao, project_name) <= 1:
            projects.append(project_name)
    return projects
