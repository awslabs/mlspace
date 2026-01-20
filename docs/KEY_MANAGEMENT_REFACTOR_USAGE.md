# Key Management Refactor Usage Guide

This document explains how to use the refactored key management system with separate functions, Pydantic models, and rotation schedules.

## Overview

The refactored system provides:

- **Separate functions** for state and token key initialization and rotation
- **Pydantic models** for type-safe key data management with domain methods
- **Rotation schedules** using AWS Secrets Manager instead of EventBridge
- **Automatic cleanup** of old key versions during rotation
- **No custom resources** - relies on rotation schedules directly

## CDK Usage

### Basic Setup

```typescript
import { AuthSecretsConstruct } from './constructs/auth/authSecretsConstruct';

const authSecrets = new AuthSecretsConstruct(this, 'AuthSecrets', {
  lambdaSourcePath: 'backend/src',
  mlSpaceAppRole: appRole,
  encryptionKey: kmsKey,
  
  // Enable automatic rotation
  enableStateKeyRotation: true,
  enableTokenKeyRotation: true,
  
  // Rotation intervals (optional, defaults to 90 days)
  stateKeyRotationDays: 60,
  tokenKeyRotationDays: 90,
  
  // Optional OIDC client secret
  oidcClientSecret: 'your-oidc-client-secret'
});
```

### Manual Initialization (if needed)

```typescript
// Create manual initialization functions
const { stateInit, tokenInit } = authSecrets.createManualInitializationFunctions();

// These can be invoked manually to initialize secrets
// Event payload: { "secret_arn": "arn:...", "key_type": "state" }
```

## Python Usage

### Using the Pydantic Models

```python
from ml_space_lambda.auth.models.key_models import VersionedKeyData, KeyType

# Load key data from Secrets Manager
secrets_client = boto3.client("secretsmanager")
response = secrets_client.get_secret_value(SecretId=secret_arn)
key_data = VersionedKeyData.from_secrets_manager_format(response["SecretString"])

# Use domain methods
current_key = key_data.get_current_key()
available_versions = key_data.get_available_versions()

# Add new version
new_version = key_data.add_new_key_version(encoded_new_key, "manual_rotator")

# Cleanup old versions
removed_versions = key_data.cleanup_old_versions(keep_versions=3)

# Save back to Secrets Manager
secrets_client.update_secret(
    SecretId=secret_arn,
    SecretString=key_data.to_secrets_manager_format()
)
```

### Using the Rotation Functions

```python
from ml_space_lambda.auth.utils.key_rotation import (
    initialize_state_encryption_key,
    initialize_token_encryption_key,
    rotate_state_encryption_key,
    rotate_token_encryption_key,
    get_key_status
)

# Initialize secrets
state_result = initialize_state_encryption_key(state_secret_arn)
token_result = initialize_token_encryption_key(token_secret_arn)

# Rotate keys (includes automatic cleanup)
rotation_result = rotate_token_encryption_key(
    secret_arn=token_secret_arn,
    keep_versions=3  # Keep 3 most recent versions
)

print(f"Rotated from v{rotation_result.previous_version} to v{rotation_result.new_version}")
print(f"Total versions: {rotation_result.total_versions}")

# Get key status
status = get_key_status(secret_arn)
if status.success:
    print(f"Current version: {status.current_version}")
    print(f"Available versions: {status.available_versions}")
```

## Key Features

### 1. AWS Secrets Manager Rotation Protocol

The system now properly implements the AWS Secrets Manager rotation protocol with four steps:

```python
# Rotation steps handled automatically by AWS Secrets Manager:
# 1. createSecret - Creates new key version with AWSPENDING label
# 2. setSecret - Sets the new secret (already done in step 1)
# 3. testSecret - Validates the new key version
# 4. finishSecret - Moves AWSPENDING to AWSCURRENT label

# The rotation handlers follow this protocol:
def state_key_secrets_manager_rotation_handler(event, context):
    secret_arn = event['SecretId']  # Provided by Secrets Manager
    step = event['Step']            # createSecret, setSecret, testSecret, finishSecret
    token = event.get('Token', 'AWSCURRENT')  # AWSPENDING for new versions
```

### 2. Domain-Driven Design

The `VersionedKeyData` class encapsulates all key management logic:

```python
# Instead of manually manipulating dictionaries
key_data.add_new_key_version(new_key, "rotator")
key_data.cleanup_old_versions(3)

# Instead of manual JSON handling
json_str = key_data.to_secrets_manager_format()
key_data = VersionedKeyData.from_secrets_manager_format(json_str)
```

### 2. Automatic Cleanup

Rotation functions automatically clean up old versions:

```python
# This will rotate AND cleanup in one operation
result = rotate_token_encryption_key(secret_arn, keep_versions=3)
print(result.message)  # "Rotated to version 5, removed 2 old versions"
```

### 3. Type Safety with Enums

```python
from ml_space_lambda.auth.models.key_models import KeyType

# Use enums instead of strings
key_data = VersionedKeyData.create_initial(
    encoded_key=key,
    key_type=KeyType.TOKEN,  # Instead of "token"
    created_by="initializer"
)
```

### 4. Rotation Schedules

The system uses AWS Secrets Manager rotation schedules instead of EventBridge:

- Automatic rotation every N days
- Built-in retry logic
- Integration with AWS monitoring
- No custom EventBridge rules needed

## Migration from Old System

### 1. Update CDK Props

```typescript
// Old
enableTokenKeyRotation: true,
tokenKeyRotationSchedule: Schedule.rate(Duration.days(90))

// New
enableStateKeyRotation: true,
enableTokenKeyRotation: true,
stateKeyRotationDays: 90,
tokenKeyRotationDays: 90
```

### 2. Remove Custom Resources

The new system doesn't need custom resources for initialization. Secrets are initialized through the rotation schedule or manual functions.

### 3. Update Lambda Handlers

```python
# Old
rotation_manager = KeyRotationManager()
result = rotation_manager.rotate_token_encryption_key(secret_arn)

# New
result = rotate_token_encryption_key(secret_arn, keep_versions=3)
```

## Benefits

1. **Cleaner Architecture**: Separate concerns with dedicated functions
2. **Type Safety**: Pydantic models prevent runtime errors
3. **Domain Logic**: Business logic encapsulated in domain objects
4. **Automatic Cleanup**: No need for separate cleanup operations
5. **Better Integration**: Uses AWS Secrets Manager rotation natively
6. **Simplified Deployment**: No custom resources needed

## Testing

```python
# Test key data manipulation
key_data = VersionedKeyData.create_initial("test-key", KeyType.STATE)
assert key_data.current_version == 1
assert key_data.get_current_key() == "test-key"

# Test rotation
new_version = key_data.add_new_key_version("new-key", "test")
assert new_version == 2
assert key_data.current_version == 2

# Test cleanup
removed = key_data.cleanup_old_versions(1)
assert len(removed) == 1
assert "1" in removed
```