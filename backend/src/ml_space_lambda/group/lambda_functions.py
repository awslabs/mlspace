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
import logging
import re
import urllib
from typing import List, Optional

from ml_space_lambda.data_access_objects.group import GroupDAO, GroupModel
from ml_space_lambda.data_access_objects.group_user import GroupUserDAO, GroupUserModel
from ml_space_lambda.data_access_objects.user import UserDAO, UserModel
from ml_space_lambda.enums import Permission
from ml_space_lambda.utils.common_functions import api_wrapper, serialize_permissions, validate_input
from ml_space_lambda.utils.exceptions import ResourceNotFound

logger = logging.getLogger(__name__)
group_dao = GroupDAO()
group_user_dao = GroupUserDAO()
user_dao = UserDAO()

group_name_regex = re.compile(r"[^a-zA-Z0-9]")
group_desc_regex = re.compile(r"/[^ -~]/")


def _add_group_user(group_name: str, username: str, permissions: Optional[List[Permission]] = None):
    # TODO: add IAM Management here, like we are doing in project user creation
    iam_role_arn = None

    if not user_dao.get(username):
        raise ValueError("Username specified is not associated with an active user.")
    try:
        group_user = GroupUserModel(
            group_name=group_name,
            username=username,
            permissions=permissions,
            role=iam_role_arn,
        )
        group_user_dao.create(group_user)
    except Exception as e:
        # TODO: add IAM Management cleanup here, like we are doing in project user creation
        raise e


def _total_group_owners(group_name: str):
    this_group_users = group_user_dao.get_users_for_group(group_name)
    owner_count = 0

    for user in this_group_users:
        if Permission.GROUP_OWNER in user.permissions:
            owner_count += 1

    return owner_count


@api_wrapper
def get(event, context):
    group_name = event["pathParameters"]["groupName"]
    group = group_dao.get(group_name)
    if not group:
        raise ResourceNotFound(f"Specified group {group_name} does not exist.")
    user = UserModel.from_dict(json.loads(event["requestContext"]["authorizer"]["user"]))
    group_user = group_user_dao.get(group_name, user.username)
    if Permission.ADMIN not in user.permissions and not group_user:
        raise ValueError(f"User is not a member of group {group_name}.")

    return {
        "group": group.to_dict(),
        "permissions": serialize_permissions(group_user.permissions) if group_user else [],
    }


@api_wrapper
def create(event, context):
    try:
        group_created = False
        username = event["requestContext"]["authorizer"]["principalId"]
        event_body = json.loads(event["body"])
        group_name = event_body["name"]

        validate_input(group_name, 24, "Group name", group_name_regex)
        validate_input(event_body["description"], 4000, "Group description", group_desc_regex)

        # Check if the group name already exists in the table
        existing_goup = group_dao.get(group_name)

        if existing_goup:
            raise Exception(
                "Group name already exists."
            )

        # set group creator
        event_body.update({"createdBy": username})
        new_group = GroupModel.from_dict(event_body)
        group_dao.create(new_group)
        group_created = True
        _add_group_user(group_name, username, [Permission.GROUP_OWNER, Permission.COLLABORATOR])

        return f"Successfully created group '{group_name}'"
    except Exception as e:
        logging.error(f"Error creating group: {e}")
        # Clean up any resources which may have been created prior to the error
        if group_created:
            group_dao.delete(group_name)

        raise e


@api_wrapper
def group_users(event, context):
    group_name = event["pathParameters"]["groupName"]
    members = group_user_dao.get_users_for_group(group_name)

    return [member.to_dict() for member in members]


@api_wrapper
def add_users(event, context):
    group_name = event["pathParameters"]["groupName"]
    request = json.loads(event["body"])
    usernames = request["usernames"]
    for username in usernames:
        _add_group_user(group_name, username, [Permission.COLLABORATOR])

    return f"Successfully added {len(usernames)} user(s) to {group_name}"


@api_wrapper
def remove_user(event, context):
    group_name = event["pathParameters"]["groupName"]
    username = urllib.parse.unquote(event["pathParameters"]["username"])

    # first check if user is an owner on the group.
    group_member = group_user_dao.get(group_name, username)

    if not group_member:
        raise Exception(f"{username} is not a member of {group_name}")

    if Permission.GROUP_OWNER not in group_member.permissions or _total_group_owners(group_name) > 1:
        # TODO: Remove IAM role for group user, like we do for projects
        group_user_dao.delete(group_name, username)
        return f"Successfully removed {username} from {group_name}"

    raise Exception("You cannot delete the last owner of a group")


@api_wrapper
def list_all(event, context):
    user = UserModel.from_dict(json.loads(event["requestContext"]["authorizer"]["user"]))
    if Permission.ADMIN in user.permissions:
        groups = group_dao.get_all()
    else:
        group_names = [group.group for group in group_user_dao.get_groups_for_user(user.username)]
        groups = group_dao.get_all(group_names=group_names)
    return [group.to_dict() for group in groups]


@api_wrapper
def update(event, context):
    group_name = event["pathParameters"]["groupName"]
    event_body = json.loads(event["body"])

    existing_group = group_dao.get(group_name)
    if not existing_group:
        raise ValueError("Specified group does not exist")
    if "description" in event_body:
        validate_input(event_body["description"], 4000, "description", group_desc_regex)
        existing_group.description = event_body["description"]

    group_dao.update(group_name, existing_group)

    return f"Successfully updated {group_name}"


@api_wrapper
def delete(event, context):
    group_name = event["pathParameters"]["groupName"]

    # Verify group exists
    existing_group = group_dao.get(group_name)
    if not existing_group:
        raise ValueError("Specified group does not exist")

    # Delete users associations and group itself
    to_delete_group_users = group_user_dao.get_users_for_group(group_name)

    # TODO: Update IAM Roles, like we do for project users
    # Remove all group related entries from the user/group table
    for group_user in to_delete_group_users:
        group_user_dao.delete(group_name, group_user.user)

    # Delete the group record last
    group_dao.delete(group_name)

    return f"Successfully deleted {group_name}."


@api_wrapper
def update_group_user(event, context):
    group_name = event["pathParameters"]["groupName"]
    username = urllib.parse.unquote(event["pathParameters"]["username"])
    updates = json.loads(event["body"])

    group_user = group_user_dao.get(group_name, username)

    if not group_user:
        raise ResourceNotFound(f"User {username} is not a member of {group_name}")

    if Permission.GROUP_OWNER in group_user.permissions and Permission.GROUP_OWNER.value not in updates["permissions"]:
        if _total_group_owners(group_name) < 2:
            raise Exception(f"Cannot remove last Group Owner from {group_name}.")

    if sorted(updates["permissions"]) != sorted(serialize_permissions(group_user.permissions)):
        group_user.permissions = [Permission(entry) for entry in updates["permissions"]]
        group_user_dao.update(group_name, username, group_user)

    return "Successfully updated group user record."
