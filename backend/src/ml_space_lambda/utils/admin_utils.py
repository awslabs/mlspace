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
from typing import Any, Dict

from ml_space_lambda.data_access_objects.user import UserModel
from ml_space_lambda.enums import Permission


def is_admin_get_all(user: UserModel, event: Dict[str, Dict[str, Any]]):
    query_params = event.get("queryStringParameters", {})
    return (
        Permission.ADMIN in user.permissions
        and query_params is not None
        and query_params.get("adminGetAll", "false") == "true"
    )
