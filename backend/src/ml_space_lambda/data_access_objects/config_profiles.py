import json
import logging
import time
import uuid
from typing import List, Optional, Dict, Any

import boto3
from dynamodb_json import json_util as dynamodb_json
from boto3.dynamodb.conditions import Key

from ml_space_lambda.data_access_objects.dynamo_data_store import DynamoDBObjectStore
from ml_space_lambda.enums import EnvVariable
from ml_space_lambda.utils.exceptions import ResourceInUseError
from ml_space_lambda.utils.mlspace_config import get_environment_variables

log = logging.getLogger(__name__)


class ConfigProfileModel:
    """
    Model for Dynamic Configuration Profile.
    Encapsulates the data schema and provides conversion to/from dict.
    """
    def __init__(
            self,
            profile_id: Optional[str],
            name: str,
            description: Optional[str],
            notebook_instance_types: List[str],
            training_job_instance_types: List[str],
            hpo_job_instance_types: List[str],
            transform_job_instance_types: List[str],
            endpoint_instance_types: List[str],
            created_by: Optional[str] = None,
            created_at: Optional[int] = None,
            updated_by: Optional[str] = None,
            updated_at: Optional[int] = None
    ):
        self.profile_id = profile_id or str(uuid.uuid4())
        self.name = name
        self.description = description
        self.notebook_instance_types = notebook_instance_types
        self.training_job_instance_types = training_job_instance_types
        self.hpo_job_instance_types = hpo_job_instance_types
        self.transform_job_instance_types = transform_job_instance_types
        self.endpoint_instance_types = endpoint_instance_types
        self.created_by = created_by
        self.created_at = created_at or int(time.time())
        self.updated_by = updated_by
        self.updated_at = updated_at or int(time.time())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "profileId": self.profile_id,
            "name": self.name,
            "description": self.description,
            "notebookInstanceTypes": self.notebook_instance_types,
            "trainingJobInstanceTypes": self.training_job_instance_types,
            "hpoJobInstanceTypes": self.hpo_job_instance_types,
            "transformJobInstanceTypes": self.transform_job_instance_types,
            "endpointInstanceTypes": self.endpoint_instance_types,
            "createdBy": self.created_by,
            "createdAt": self.created_at,
            "updatedBy": self.updated_by,
            "updatedAt": self.updated_at,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ConfigProfileModel':
        return cls(
            profile_id=data.get("profileId"),
            name=data["name"],
            description=data.get("description"),
            notebook_instance_types=data.get("notebookInstanceTypes", []),
            training_job_instance_types=data.get("trainingJobInstanceTypes", []),
            hpo_job_instance_types=data.get("hpoJobInstanceTypes", []),
            transform_job_instance_types=data.get("transformJobInstanceTypes", []),
            endpoint_instance_types=data.get("endpointInstanceTypes", []),
            created_by=data.get("createdBy"),
            created_at=data.get("createdAt"),
            updated_by=data.get("updatedBy"),
            updated_at=data.get("updatedAt"),
        )


class ConfigProfilesDAO(DynamoDBObjectStore):
    """
    DAO for Dynamic Configuration Profiles (DCPs).
    """

    def __init__(self, table_name: Optional[str] = None, client=None):
        self.env_vars = get_environment_variables()
        table = table_name if table_name else self.env_vars[EnvVariable.CONFIGURATION_PROFILES_TABLE]
        super().__init__(table_name=table, client=client)
        # Projects table for delete validation
        projects_table_name = self.env_vars[EnvVariable.PROJECTS_TABLE]
        self.projects_table = boto3.resource("dynamodb").Table(projects_table_name)

    def list(self) -> List[Dict[str, Any]]:
        """List all DCP metadata entries (profileId, name, description, updatedAt)."""
        items = self._scan(
            projection_expression="profileId, #n, description, updatedAt",
            expression_names={"#n": "name"},
            page_response=False
        )
        return items.records

    def get(self, profile_id: str) -> Optional[ConfigProfileModel]:
        """Retrieve a full DCP record by profileId."""
        try:
            item = self._retrieve({"profileId": profile_id})
            return ConfigProfileModel.from_dict(item)
        except KeyError:
            return None

    def create(self, model: ConfigProfileModel) -> ConfigProfileModel:
        """Create a new DCP. Assigns UUID and timestamps."""
        now = int(time.time())
        model.created_at = now
        model.updated_at = now
        item = model.to_dict()
        self._create(item)
        return model

    def update(self, model: ConfigProfileModel) -> ConfigProfileModel:
        now = int(time.time())
        model.updated_at = now

        # Turn into a flat dict, then pop off immutable fields
        updates = model.to_dict()
        updates.pop("profileId", None)
        updates.pop("createdBy", None)
        updates.pop("createdAt",  None)

        # Build placeholders
        expr_names = {}
        expr_values = {}
        set_clauses = []
        for attr_name, attr_val in updates.items():
            # e.g. #name = :name
            name_placeholder = f"#{attr_name}"
            value_placeholder = f":{attr_name}"
            expr_names[name_placeholder] = attr_name
            expr_values[value_placeholder] = attr_val
            set_clauses.append(f"{name_placeholder} = {value_placeholder}")

        update_expression = "SET " + ", ".join(set_clauses)

        # Marshal the DynamoDB‐compatible JSON for the values
        dynamo_values = json.loads(dynamodb_json.dumps(expr_values))

        # Perform the update, asking for ALL_NEW back
        resp = self.client.update_item(
            TableName=self.table_name,
            Key=json.loads(dynamodb_json.dumps({"profileId": model.profile_id})),
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expr_names,
            ExpressionAttributeValues=dynamo_values,
            ReturnValues="ALL_NEW",
        )

        # Unmarshal the returned Attributes into a Python dict
        new_item = dynamodb_json.loads(resp["Attributes"])
        return ConfigProfileModel.from_dict(new_item)

    def delete(self, profile_id: str) -> None:
        """Delete a DCP if not applied to any project; raise if in use."""
        resp = self.projects_table.query(
            IndexName="configProfileId-index",
            KeyConditionExpression=Key("configProfileId").eq(profile_id),
            ProjectionExpression="projectId"
        )
        if resp.get("Count", 0) > 0:
            log.warning(f"Cannot delete DCP {profile_id}: in use by projects")
            raise ResourceInUseError(
                f"Profile {profile_id} is applied to existing projects and cannot be deleted."
            )
        self._delete({"profileId": profile_id})
        log.info(f"Deleted DCP {profile_id}")