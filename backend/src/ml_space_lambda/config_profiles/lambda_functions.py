import json
import logging

from ml_space_lambda.data_access_objects.config_profiles import ConfigProfilesDAO, ConfigProfileModel
from ml_space_lambda.utils.common_functions import api_wrapper, ApiResponse
from ml_space_lambda.utils.exceptions import ResourceInUseError

log = logging.getLogger(__name__)

# DAO for DynamoDB operations
config_profiles_dao = ConfigProfilesDAO()

@api_wrapper
def list_profiles(event, context):
    """
    GET /config-profiles
    Returns list of all profiles (metadata only).
    """
    profile_list = config_profiles_dao.list()
    return ApiResponse.ok(profile_list)

@api_wrapper
def get_profile(event, context):
    """
    GET /config-profiles/{profileId}
    Returns full profile record.
    """
    profile_id = event["pathParameters"]["profileId"]
    profile = config_profiles_dao.get(profile_id)
    if not profile:
        return ApiResponse.not_found({"message": "Profile not found"})
    return ApiResponse.ok(profile)

@api_wrapper
def create_profile(event, context):
    """
    POST /config-profiles
    Creates a new configuration profile.
    """
    payload = json.loads(event["body"])
    # Build model and add audit fields
    principal_id = event["requestContext"]["authorizer"]["principalId"]
    payload["createdBy"] = principal_id
    payload["updatedBy"] = principal_id
    profile = ConfigProfileModel(**payload)
    created_profile = config_profiles_dao.create(profile)
    return ApiResponse.created(created_profile)

@api_wrapper
def update_profile(event, context):
    """
    PUT /config-profiles/{profileId}
    Updates an existing profile.
    """
    profile_id = event["pathParameters"]["profileId"]
    principal_id = event["requestContext"]["authorizer"]["principalId"]
    profile = ConfigProfileModel(**json.loads(event["body"]), profileId=profile_id, updatedBy=principal_id)
    updated_profile = config_profiles_dao.update(profile)
    return ApiResponse.ok(updated_profile)

@api_wrapper
def delete_profile(event, context):
    """
    DELETE /config-profiles/{profileId}
    Deletes a profile if not applied to any project.
    """
    profile_id = event["pathParameters"]["profileId"]
    try:
        # Pre-delete validation: DAO should raise if in use
        config_profiles_dao.delete(profile_id)
        return ApiResponse.no_content()
    except ResourceInUseError as e:
        return ApiResponse.conflict({"message": str(e)})
