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

from __future__ import annotations

import json
import time
from typing import List, Optional

from dynamodb_json import json_util as dynamodb_json

from ml_space_lambda.data_access_objects.dynamo_data_store import DynamoDBObjectStore
from ml_space_lambda.enums import EnvVariable, GroupUserAction
from ml_space_lambda.utils.mlspace_config import get_environment_variables


class GroupMembershipHistoryModel:
    def __init__(
        self,
        username: str,
        group_name: str,
        action: GroupUserAction,
        actioned_by: str,
        actioned_at: Optional[float] = None,
    ):
        now = int(time.time())
        self.user = username
        self.group = group_name
        self.action = action
        self.actioned_by = actioned_by
        self.actioned_at = actioned_at if actioned_at else now

    def to_dict(self) -> dict:
        return {
            "user": self.user,
            "group": self.group,
            "action": self.action.value,
            "actionedBy": self.actioned_by,
            "actionedAt": self.actioned_at,
        }

    @staticmethod
    def from_dict(dict_object: dict) -> GroupMembershipHistoryModel:
        return GroupMembershipHistoryModel(
            username=dict_object["user"],
            group_name=dict_object["group"],
            action=GroupUserAction(dict_object["action"]),
            actioned_by=dict_object.get("actionedBy"),
            actioned_at=dict_object.get("actionedAt", None),
        )


class GroupMembershipHistoryDAO(DynamoDBObjectStore):
    def __init__(self, table_name: Optional[str] = None, client=None):
        self.env_vars = get_environment_variables()
        table_name = table_name if table_name else self.env_vars[EnvVariable.GROUPS_MEMBERSHIP_HISTORY_TABLE]
        DynamoDBObjectStore.__init__(self, table_name=table_name, client=client)

    def create(self, group: GroupMembershipHistoryModel) -> None:
        self._create(group.to_dict())

    def get_all_for_group(self, group_name: str) -> List[GroupMembershipHistoryModel]:
        json_response = self._query(
            key_condition_expression="#p = :group",
            expression_names={"#p": "group"},
            expression_values=json.loads(dynamodb_json.dumps({":group": group_name})),
        ).records
        return [GroupMembershipHistoryModel.from_dict(entry) for entry in json_response]
