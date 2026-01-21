# User ID Field Implementation Summary

## Overview
Added a durable `id` field to the UserModel to store the IdP's "sub" claim, ensuring consistent user identification across authentication sessions.

## Changes Made

### 1. UserModel Updates (`backend/src/ml_space_lambda/data_access_objects/user.py`)

**Added `id` field:**
- New optional parameter in `__init__`: `id: Optional[str] = None`
- Stores the IdP's durable identifier (e.g., OIDC "sub" claim)
- Gracefully handles missing field for backward compatibility

**Updated `to_dict()` method:**
- Only includes `id` in the dictionary if it's set (not None)
- Prevents unnecessary null values in DynamoDB

**Updated `from_dict()` method:**
- Gracefully handles missing `id` field with `dict_object.get("id", None)`
- Ensures backward compatibility with existing user records

### 2. UserDAO Updates (`backend/src/ml_space_lambda/data_access_objects/user.py`)

**Updated `update()` method:**
- Conditionally adds `id` to the update expression if it's set
- Enables backfilling the `id` field for existing users on their next login
- Maintains backward compatibility

### 3. OIDC Handler Updates (`backend/src/ml_space_lambda/auth/handlers/oidc_handler.py`)

**Updated `normalize_user_data()` method:**
- Uses OIDC "sub" claim as the durable identifier
- Uses "preferred_username" for the username (sanitized)
- Sanitizes special characters (`,`, `=`, ` `) by replacing with `-`
- Falls back to email prefix if preferred_username is missing
- Stores "sub" claim in attributes for reference
- Matches frontend user creation pattern from `oidc.config.ts`

**Username mapping:**
- `user_data.id` = sanitized preferred_username (for MLSpace username)
- `user_data.attributes["sub"]` = IdP's sub claim (durable identifier)

### 4. Auth Lambda Updates (`backend/src/ml_space_lambda/auth/lambda_functions.py`)

**Updated `_ensure_user_exists()` function:**
- Extracts "sub" claim from `user_data.attributes`
- For existing users: backfills `id` field if missing
- For new users: sets `id` field to the IdP's "sub" claim
- Maintains consistency with frontend user creation pattern
- Sets `username` and `display_name` matching the frontend implementation

**User creation consistency:**
- `username`: sanitized preferred_username (matching frontend)
- `display_name`: name claim from IdP (matching frontend)
- `email`: email claim from IdP
- `id`: sub claim from IdP (new field)

### 5. Enum Updates (`backend/src/ml_space_lambda/enums.py`)

**Added missing enum value:**
- `NEW_USERS_SUSPENDED = "NEW_USERS_SUSPENDED"` for backward compatibility
- Resolves existing inconsistency in the codebase

### 6. Test Updates (`backend/test/auth/test_lambda_functions.py`)

**Updated test mock data:**
- Added `"sub": "idp-sub-12345"` to mock user attributes
- Ensures tests properly validate the new id field functionality

## Behavior

### New Users
When a user logs in for the first time:
1. OIDC handler extracts "sub" claim and sanitizes preferred_username
2. `_ensure_user_exists()` creates a new UserModel with:
   - `username`: sanitized preferred_username
   - `display_name`: name from IdP
   - `id`: sub claim from IdP
3. User is created in DynamoDB with all fields

### Existing Users
When an existing user logs in:
1. OIDC handler extracts "sub" claim and sanitizes preferred_username
2. `_ensure_user_exists()` retrieves existing user
3. If `id` field is missing, it's backfilled with the sub claim
4. `last_login` timestamp is updated
5. User record is updated in DynamoDB

### Backward Compatibility
- Existing users without `id` field: gracefully handled, field is None
- `to_dict()` excludes `id` if None (no null values in DynamoDB)
- `from_dict()` handles missing `id` field gracefully
- Update operation only includes `id` if it's set

## Testing

All tests pass successfully:
- ✅ User DAO tests (9/9 passed)
- ✅ Auth lambda tests (10/10 passed for login/callback)
- ✅ UserModel with id field
- ✅ UserModel without id field (backward compatibility)
- ✅ OIDC normalize_user_data with sub claim
- ✅ Username sanitization

## Migration Path

No migration required! The implementation is fully backward compatible:
1. Existing users continue to work without the `id` field
2. On next login, the `id` field is automatically backfilled
3. New users get the `id` field from the start
4. No database schema changes needed (DynamoDB is schemaless)
