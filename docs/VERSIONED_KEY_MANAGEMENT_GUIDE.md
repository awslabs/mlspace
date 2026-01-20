# Versioned Key Management Guide

This document explains how the refactored key management system handles multiple versions and cleanup using only the new versioned format.

## ✅ **Version Handling - Versioned Format Only**

### **Simplified Architecture**

All consumers of the secrets now expect only the versioned format:

```python
# _get_secret_value() function - simplified
def _get_secret_value(secret_arn: str, key: str = "key") -> str:
    response = secrets_client.get_secret_value(SecretId=secret_arn)
    # Always expect versioned format
    key_data = VersionedKeyData.from_secrets_manager_format(response["SecretString"])
    return key_data.get_current_key()
```

### **Places Using Versioned Keys**

1. **`_get_secret_value()` in `lambda_functions.py`** - Always expects versioned format
2. **`VersionedKeyManager` in `key_manager.py`** - Designed for versioned keys
3. **`authorizer/lambda_function.py`** - Uses `VersionedTokenEncryption` directly
4. **All rotation functions** - Work with versioned format using AWS Secrets Manager protocol

### **Versioned Token Encryption**

The `VersionedTokenEncryption` class handles multiple key versions seamlessly:

```python
# Encryption always uses current key
encrypted = encryption.encrypt_token("my-token")
# Result: "v2:v4.local.encrypted_data"

# Decryption works with any available version
decrypted = encryption.decrypt_token("v1:v4.local.old_encrypted_data")  # Works!
decrypted = encryption.decrypt_token("v2:v4.local.new_encrypted_data")  # Works!
```

### **Versioned State Management**

Similarly, state parameters support multiple versions:

```python
# Creation uses current key
state = state_manager.create_state(redirect_url, domain, nonce)
# Result: "v2:encrypted_state_data"

# Validation works with any version
state_data = state_manager.validate_state("v1:old_encrypted_state", nonce)  # Works!
```

## ✅ **Old Version Cleanup**

### **Two-Level Cleanup System**

The system implements cleanup at two levels:

#### **1. Internal Key Cleanup (Within Secret Content)**

```python
# During rotation, old internal key versions are cleaned up
removed_versions = key_data.cleanup_old_versions(keep_versions=3)
# Keeps only the 3 most recent key versions within the secret
```

#### **2. AWS Secrets Manager Version Cleanup**

```python
def cleanup_old_secret_versions(secret_arn: str, keep_versions: int = 3):
    """Clean up old AWS Secrets Manager versions."""
    # Gets all secret versions from AWS
    # Protects AWSCURRENT and AWSPENDING versions
    # Deletes older versions beyond keep_versions limit
```

### **Automatic Cleanup During Rotation**

Cleanup happens automatically during the `finishSecret` step:

```python
def finalize_secrets_manager_rotation(secret_arn: str, token: str = "AWSPENDING"):
    # 1. Move AWSPENDING → AWSCURRENT
    secrets_client.update_secret_version_stage(...)
    
    # 2. Clean up old secret versions automatically
    cleanup_result = cleanup_old_secret_versions(secret_arn, keep_versions=3)
```

### **What Gets Cleaned Up**

1. **Internal Key Versions**: Old key versions within the secret content (keeps 3 most recent)
2. **AWS Secret Versions**: Old AWS Secrets Manager versions (keeps 3 most recent + protected versions)
3. **Protected Versions**: AWSCURRENT and AWSPENDING are never deleted

## **AWS Secrets Manager Rotation Protocol**

### **Rotation Steps**

The system follows the standard AWS Secrets Manager rotation protocol:

```python
# Event structure from AWS Secrets Manager:
{
    "SecretId": "arn:aws:secretsmanager:...",  # Secret ARN
    "Step": "createSecret",                    # Rotation step
    "Token": "AWSPENDING"                      # Version stage
}

# Rotation steps:
# 1. createSecret - Creates new key version with AWSPENDING label
# 2. setSecret - Sets the new secret (no-op for our use case)
# 3. testSecret - Validates the new key version
# 4. finishSecret - Moves AWSPENDING to AWSCURRENT and cleans up
```

### **Simplified Functions**

All rotation functions now use the AWS Secrets Manager protocol:

```python
# Single function for each key type
def rotate_state_encryption_key(secret_arn: str, token: str = "AWSPENDING", keep_versions: int = 3)
def rotate_token_encryption_key(secret_arn: str, token: str = "AWSPENDING", keep_versions: int = 3)
```

## **Configuration**

### **CDK Setup**

```typescript
const authSecrets = new AuthSecretsConstruct(this, 'AuthSecrets', {
  enableStateKeyRotation: true,
  enableTokenKeyRotation: true,
  stateKeyRotationDays: 90,
  tokenKeyRotationDays: 90,
});
```

### **Retention Policy**

```python
# Keep 3 versions (default)
rotate_token_encryption_key(secret_arn, keep_versions=3)

# Keep 5 versions for longer grace period
rotate_token_encryption_key(secret_arn, keep_versions=5)
```

## **Key Benefits**

### **1. Simplified Architecture**

- No legacy format handling
- Single code path for all operations
- Cleaner, more maintainable code

### **2. Zero Downtime Rotation**

- Old tokens remain valid during rotation
- New tokens use new keys immediately
- Gradual transition as old tokens expire

### **3. Automatic Cleanup**

- No manual intervention required
- Prevents accumulation of old versions
- Configurable retention policy

### **4. AWS Native Integration**

- Uses proper Secrets Manager rotation protocol
- Built-in retry logic and monitoring
- Integration with CloudWatch

## **Monitoring & Observability**

```python
# Get status of key versions
status = get_key_status(secret_arn)
print(f"Current version: {status.current_version}")
print(f"Available versions: {status.available_versions}")
print(f"Last rotation: {status.last_rotation}")
```

## **Best Practices**

1. **Monitor Rotation**: Set up CloudWatch alarms for rotation failures
2. **Test Rotation**: Test rotation in non-production environments first
3. **Gradual Rollout**: Enable rotation on less critical environments first
4. **Version Monitoring**: Monitor the number of active versions
5. **Retention Policy**: Choose appropriate `keep_versions` based on your token TTL

This simplified versioned system ensures seamless key rotation with automatic cleanup while maintaining a clean, maintainable codebase focused solely on the versioned format.