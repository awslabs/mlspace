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

from unittest import mock

import pytest

from ml_space_lambda.data_access_objects.group_user import GroupUserModel
from ml_space_lambda.data_access_objects.project_group import ProjectGroupModel
from ml_space_lambda.data_access_objects.project_user import ProjectUserModel
from ml_space_lambda.enums import Permission
from ml_space_lambda.utils.project_utils import is_member_of_project, is_owner_of_project

PROJECT_NAME = "MyFakeProject"
GROUP_NAME = "MyFakeGroup"
NORMAL_USERNAME = "memberuser"

PROJECT_USER = ProjectUserModel(NORMAL_USERNAME, PROJECT_NAME)
OWNER_PROJECT_USER = ProjectUserModel(NORMAL_USERNAME, PROJECT_NAME, permissions=[Permission.PROJECT_OWNER])

GROUP_USER = GroupUserModel(NORMAL_USERNAME, GROUP_NAME)
PROJECT_GROUP = ProjectGroupModel(GROUP_NAME, PROJECT_NAME)
OWNER_PROJECT_GROUP = ProjectGroupModel(GROUP_NAME, PROJECT_NAME, permissions=[Permission.PROJECT_OWNER])


@pytest.mark.parametrize(
    "project_user,group_users,project_groups,is_member",
    [
        (None, [], [], False),
        (PROJECT_USER, [], [], False),
        (OWNER_PROJECT_USER, [], [], True),
        (PROJECT_USER, [GROUP_USER], [], False),
        (None, [GROUP_USER], [], False),
        (None, [], [PROJECT_GROUP], False),
        (None, [], [OWNER_PROJECT_GROUP], False),
        (None, [GROUP_USER], [PROJECT_GROUP], False),
        (None, [GROUP_USER], [OWNER_PROJECT_GROUP], True),
    ],
    ids=[
        "no_project_user__no_group_users__no_project_groups",
        "yes_project_user__no_group_users__no_project_groups",
        "owner_project_user__no_group_users__no_project_groups",
        "yes_project_user__yes_group_users__no_project_groups",
        "no_project_user__yes_group_users__no_project_groups",
        "no_project_user__no_group_users__yes_project_groups",
        "no_project_user__no_group_users__owner_project_groups",
        "no_project_user__yes_group_users__yes_project_groups",
        "no_project_user__yes_group_users__owner_project_groups",
    ],
)
@mock.patch("ml_space_lambda.utils.project_utils.project_group_dao")
@mock.patch("ml_space_lambda.utils.project_utils.group_user_dao")
@mock.patch("ml_space_lambda.utils.project_utils.project_user_dao")
def test_is_owner_of_project(
    mock_project_user_dao, mock_group_user_dao, mock_project_group_dao, project_user, group_users, project_groups, is_member
):
    mock_project_user_dao.get.return_value = project_user
    mock_group_user_dao.get_groups_for_user.return_value = group_users
    mock_project_group_dao.get_groups_for_project.return_value = project_groups

    assert is_member == is_owner_of_project(NORMAL_USERNAME, PROJECT_NAME)


@pytest.mark.parametrize(
    "project_user,group_users,project_groups,is_member",
    [
        (None, [], [], False),
        (None, [GROUP_USER], [], False),
        (None, [], [PROJECT_GROUP], False),
        (PROJECT_USER, [], [], True),
        (PROJECT_USER, [GROUP_USER], [], True),
        (PROJECT_USER, [], [PROJECT_GROUP], True),
        (PROJECT_USER, [GROUP_USER], [PROJECT_GROUP], True),
        (None, [GROUP_USER], [PROJECT_GROUP], True),
    ],
    ids=[
        "no_project_user__no_group_users__no_project_groups",
        "no_project_user__yes_group_users__no_project_groups",
        "no_project_user__no_group_users__yes_project_groups",
        "yes_project_user__no_group_users__no_project_groups",
        "yes_project_user__yes_group_users__no_project_groups",
        "yes_project_user__no_group_users__yes_project_groups",
        "yes_project_user__yes_group_users__yes_project_groups",
        "no_project_user__yes_group_users__yes_project_groups",
    ],
)
@mock.patch("ml_space_lambda.utils.project_utils.project_group_dao")
@mock.patch("ml_space_lambda.utils.project_utils.group_user_dao")
@mock.patch("ml_space_lambda.utils.project_utils.project_user_dao")
def test_is_member_of_project(
    mock_project_user_dao, mock_group_user_dao, mock_project_group_dao, project_user, group_users, project_groups, is_member
):
    mock_project_user_dao.get.return_value = project_user
    mock_group_user_dao.get_groups_for_user.return_value = group_users
    mock_project_group_dao.get_groups_for_project.return_value = project_groups

    assert is_member == is_member_of_project(NORMAL_USERNAME, PROJECT_NAME)
