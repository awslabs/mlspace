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

import logging

from ml_space_lambda.data_access_objects.group_user import GroupUserDAO
from ml_space_lambda.data_access_objects.project_user import ProjectUserDAO
from ml_space_lambda.data_access_objects.user import UserDAO
from ml_space_lambda.utils.common_functions import generate_html_response

log = logging.getLogger(__name__)
project_user_dao = ProjectUserDAO()
user_dao = UserDAO()
group_user_dao = GroupUserDAO()

DEPRECATED_PERMISSION = "CO"


def lambda_handler(event, context):
    # Check for 'CO' permissions in the User table
    for user in user_dao.get_all(include_suspended=True):
        for permission in user.permissions:
            new_permissions = []
            if permission != DEPRECATED_PERMISSION:
                new_permissions.append(permission)
            user.permissions = new_permissions
            user_dao.update(user.username, user)

    # Check for 'CO' permissions in the ProjectUser table
    for project_user in project_user_dao.get_all():
        for permission in project_user.permissions:
            new_permissions = []
            if permission != DEPRECATED_PERMISSION:
                new_permissions.append(permission)
            project_user.permissions = new_permissions
            project_user_dao.update(project_user.project, project_user.user, project_user)

    # Check for 'CO' permissions in the GroupUser table
    for group_user in group_user_dao.get_all():
        for permission in group_user.permissions:
            new_permissions = []
            if permission != DEPRECATED_PERMISSION:
                new_permissions.append(permission)
            group_user.permissions = new_permissions
            group_user_dao.update(group_user.group, group_user.user, group_user)

    return generate_html_response(200, "Successfully cleaned up deprecated permissions")
