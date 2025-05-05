import json
import logging
import time
import uuid
from typing import List, Optional, Dict, Any

import boto3
from dynamodb_json import json_util as dynamodb_json
from boto3.dynamodb.conditions import Key
from pydantic.v1 import BaseModel, Field, root_validator

from ml_space_lambda.data_access_objects.dynamo_data_store import DynamoDBObjectStore
from ml_space_lambda.enums import EnvVariable
from ml_space_lambda.utils.exceptions import ResourceInUseError
from ml_space_lambda.utils.mlspace_config import get_environment_variables

log = logging.getLogger(__name__)


class ConfigProfileModel(BaseModel):
    """
    Model for Dynamic Configuration Profile
    """
    profileId: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    notebookInstanceTypes: List[str]
    trainingJobInstanceTypes: List[str]
    hpoJobInstanceTypes: List[str]
    transformJobInstanceTypes: List[str]
    endpointInstanceTypes: List[str]
    createdBy: Optional[str] = None
    createdAt: int = Field(default_factory=lambda: int(time.time()))
    updatedBy: Optional[str] = None
    updatedAt: int = Field(default_factory=lambda: int(time.time()))

    @root_validator(pre=True)
    def inject_defaults(cls, values):
        now = int(time.time())
        if values.get("profileId") is None:
            values["profileId"] = str(uuid.uuid4())
        if values.get("createdAt") is None:
            values["createdAt"] = now
        if values.get("updatedAt") is None:
            values["updatedAt"] = now
        return values

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
            return self._retrieve({"profileId": profile_id})
        except KeyError:
            return None

    def create(self, model: ConfigProfileModel) -> ConfigProfileModel:
        """Create a new DCP. Assigns timestamps."""
        now = int(time.time())
        model.createdAt = now
        model.updatedAt = now
        item = model.dict(by_alias=True, exclude_none=True)
        self._create(item)
        return model

    def update(self, model: ConfigProfileModel) -> ConfigProfileModel:
        # bump timestamp, then extract the JSON‑friendly dict
        model.updatedAt = int(time.time())
        data = model.dict(by_alias=True, exclude_none=True)

        # drop the keys you don't want to SET
        for k in ("profileId", "createdBy", "createdAt"):
            data.pop(k, None)

        # build the DynamoDB SET expression
        expr_names = {}
        expr_values = {}
        set_clauses = []
        for field, val in data.items():
            placeholder_name = f"#{field}"
            placeholder_val  = f":{field}"
            expr_names   [placeholder_name] = field
            expr_values  [placeholder_val ] = val
            set_clauses.append(f"{placeholder_name} = {placeholder_val}")

        update_expr = "SET " + ", ".join(set_clauses)
        dynamo_vals = json.loads(dynamodb_json.dumps(expr_values))

        resp = self.client.update_item(
            TableName=self.table_name,
            Key={"profileId": {"S": model.profileId}},
            UpdateExpression=update_expr,
            ExpressionAttributeNames = expr_names,
            ExpressionAttributeValues= dynamo_vals,
            ReturnValues="ALL_NEW",
        )

        new_item = dynamodb_json.loads(resp["Attributes"])
        # return a fresh Pydantic model
        return ConfigProfileModel(**new_item)

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