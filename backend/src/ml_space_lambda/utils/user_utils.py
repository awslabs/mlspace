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

from ml_space_lambda.data_access_objects.user import UserDAO


def ensure_users_exist(usernames: list[str], user_dao: UserDAO):
    usernames_not_found = []

    for username in usernames:
        if user_dao.get(username) is None:
            usernames_not_found.append(username)

    if len(usernames_not_found) > 0:
        usernames_display = ", ".join(usernames_not_found)
        raise Exception(f"The following usernames are not associated with an active user: {usernames_display}")
