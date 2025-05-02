import json
import logging
import time

from ml_space_lambda.data_access_objects.config_profiles import ConfigProfilesDAO, ConfigProfileModel
from ml_space_lambda.utils.common_functions import api_wrapper, generate_exception_response, ApiResponse
from ml_space_lambda.utils.mlspace_config import get_environment_variables

log = logging.getLogger(__name__)

# DAO for DynamoDB operations
config_profiles_dao = ConfigProfilesDAO()
# Environment flags
env_vars = get_environment_variables()

@api_wrapper
def list_profiles(event, context):
    """
    GET /config-profiles
    Returns list of all profiles (metadata only).
    """
    try:
        items = config_profiles_dao.list()
        return ApiResponse(
            body=items,
            status_code=200
        )
    except Exception as e:
        log.exception("Failed to list config profiles")
        raise e

@api_wrapper
def get_profile(event, context):
    """
    GET /config-profiles/{profileId}
    Returns full profile record.
    """
    profile_id = event["pathParameters"]["profileId"]
    try:
        item = config_profiles_dao.get(profile_id)
        if not item:
            return ApiResponse(
                body={"message": "Profile not found"},
                status_code=404
            )
        return ApiResponse(
            body=item.to_dict(),
            status_code=200
        )
    except Exception as e:
        log.exception(f"Failed to retrieve profile {profile_id}")
        raise e

@api_wrapper
def create_profile(event, context):
    """
    POST /config-profiles
    Creates a new configuration profile.
    """
    try:
        payload = json.loads(event["body"])
        # Build model and add audit fields
        now = int(time.time())
        principal_id = event["requestContext"]["authorizer"]["principalId"]
        profile = ConfigProfileModel(
            name=payload["name"],
            description=payload.get("description"),
            notebook_instance_types=payload["notebookInstanceTypes"],
            training_job_instance_types=payload["trainingJobInstanceTypes"],
            hpo_job_instance_types=payload["hpoJobInstanceTypes"],
            transform_job_instance_types=payload["transformJobInstanceTypes"],
            endpoint_instance_types=payload["endpointInstanceTypes"],
            profile_id=None,  # DAO will assign
            created_by=principal_id,
            created_at=now,
            updated_by=principal_id,
            updated_at=now,
        )
        result = config_profiles_dao.create(profile)
        return ApiResponse(
            body=result.to_dict(),
            status_code=201
        )
    except Exception as e:
        log.exception("Failed to create config profile")
        raise e

@api_wrapper
def update_profile(event, context):
    """
    PUT /config-profiles/{profileId}
    Updates an existing profile.
    """
    profile_id = event["pathParameters"]["profileId"]
    try:
        payload = json.loads(event["body"])
        now = int(time.time())
        profile = ConfigProfileModel(
            name=payload.get("name"),
            description=payload.get("description"),
            notebook_instance_types=payload.get("notebookInstanceTypes"),
            training_job_instance_types=payload.get("trainingJobInstanceTypes"),
            hpo_job_instance_types=payload.get("hpoJobInstanceTypes"),
            transform_job_instance_types=payload.get("transformJobInstanceTypes"),
            endpoint_instance_types=payload.get("endpointInstanceTypes"),
            profile_id=profile_id,
            updated_by=event["requestContext"]["authorizer"]["principalId"],
            updated_at=now,
        )
        updated = config_profiles_dao.update(profile)
        return ApiResponse(
            body=updated.to_dict(),
            status_code=200
        )
    except Exception as e:
        log.exception(f"Failed to update profile {profile_id}")
        raise e

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
        return ApiResponse(
            body=None,
            status_code=204
        )
    except Exception as e:
        log.exception(f"Failed to delete profile {profile_id}")
        raise e
