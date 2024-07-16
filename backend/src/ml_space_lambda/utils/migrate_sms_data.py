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


from typing import Optional

from ml_space_lambda.data_access_objects.dataset import DatasetDAO, DatasetModel
from ml_space_lambda.data_access_objects.dynamo_data_store import DynamoDBObjectStore
from ml_space_lambda.data_access_objects.project import ProjectDAO, ProjectModel
from ml_space_lambda.data_access_objects.project_user import ProjectUserDAO, ProjectUserModel
from ml_space_lambda.data_access_objects.user import UserDAO, UserModel
from ml_space_lambda.enums import DatasetType, Permission


def _migrate_primary_table(
    source_table: str,
    ddb_client=None,
    mlspace_projects_table: Optional[str] = None,
    mlspace_users_table: Optional[str] = None,
    mlspace_project_users_table: Optional[str] = None,
):
    project_user_dao = ProjectUserDAO(mlspace_project_users_table, ddb_client)
    project_dao = ProjectDAO(mlspace_projects_table, ddb_client)
    user_dao = UserDAO(mlspace_users_table, ddb_client)
    source_ddb = DynamoDBObjectStore(source_table, ddb_client)
    projects_created = users_created = project_users_created = 0

    existing_data = source_ddb._scan().records
    print(f"Found {len(existing_data)} entries to migrated...")
    for record in existing_data:
        # If d_n and c_n are equal then this is either a user or a project
        if record["d_n"] == record["p_n"]:
            # Projects will have a p_des info attribute
            if "p_des" in record["info"]:
                project = ProjectModel(
                    record["p_n"],
                    record["info"]["p_des"],
                    record["info"]["suspended"] if "suspended" in record["info"] else False,
                    "System Migration",
                    record["info"]["c_date"],
                )
                project_dao.create(project)
                projects_created += 1
            elif "c_n" in record["info"]:
                user = UserModel(
                    record["d_n"],
                    record["info"]["user_email"],
                    record["info"]["c_n"],
                    record["info"]["suspended"] if "suspended" in record["info"] else False,
                    [Permission.ADMIN] if record["info"]["pmo"] is True else [],
                )
                user_dao.create(user)
                users_created += 1
        else:
            permissions = []
            if record["info"]["is_mo"] is True:
                permissions.append(Permission.PROJECT_OWNER)
            if record["info"]["is_co"] is True:
                permissions.append(Permission.COLLABORATOR)
            # If d_n and p_n are different then we have a project user record
            project_user = ProjectUserModel(
                record["d_n"],
                record["p_n"],
                record["role"] if "role" in record else None,
                permissions,
            )
            project_user_dao.create(project_user)
            project_users_created += 1

    print(
        f"Created {projects_created} projects, {users_created} users, and "
        f"{project_users_created} project -> user associations."
    )


def _migrate_access_table(source_table: str, ddb_client=None, mlspace_datasets_table: Optional[str] = None):
    dataset_dao = DatasetDAO(mlspace_datasets_table, ddb_client)
    source_ddb = DynamoDBObjectStore(source_table, ddb_client)
    existing_data = source_ddb._scan().records
    global_datasets_created = project_datasets_created = private_datasets_created = 0
    print(f"Found {len(existing_data)} entries to migrated...")
    for record in existing_data:
        if record["a_type"] == "global":
            global_datasets_created += 1
            dataset_type = DatasetType.GLOBAL
        elif record["a_type"] == record["info"]["creator"]:
            private_datasets_created += 1
            dataset_type = DatasetType.PRIVATE
        else:
            project_datasets_created += 1
            dataset_type = DatasetType.PROJECT
        dataset = DatasetModel(
            scope=record["a_type"],
            type=dataset_type,
            name=record["dataset"],
            description=record["info"]["description"],
            location=record["info"]["s3_key"],
            created_by=record["info"]["creator"],
            # This is supposed to be created at but we don't have
            # creation time in legacy systems so just using last
            # updated here
            created_at=record["info"]["last_updated"],
        )
        dataset_dao.create(dataset)

    print(
        f"Created {global_datasets_created + project_datasets_created + private_datasets_created} "
        f"datasets, {global_datasets_created} global, {project_datasets_created} project, and "
        f"{private_datasets_created} private."
    )


def migrate_sms_data(
    primary_table: str,
    access_table: str,
    ddb_client=None,
    mlspace_projects_table: Optional[str] = None,
    mlspace_users_table: Optional[str] = None,
    mlspace_project_users_table: Optional[str] = None,
    mlspace_datasets_table: Optional[str] = None,
):
    print(f"Migrating SMS Data Access Table: {access_table}...")
    _migrate_access_table(access_table, ddb_client, mlspace_datasets_table)
    print(f"Migrating SMS Project/User Table: {primary_table}...")
    _migrate_primary_table(
        primary_table,
        ddb_client,
        mlspace_projects_table,
        mlspace_users_table,
        mlspace_project_users_table,
    )
