# Key Rotation Quick Reference

## Token Key Rotation (Zero Downtime)

### Manual Rotation
```bash
aws lambda invoke \
  --function-name mlspace-key-rotation \
  --payload '{"action": "rotate_token_key", "secret_arn": "/mlspace/auth/token-encryption-keys"}' \
  response.json
```

### Check Status
```bash
aws lambda invoke \
  --function-name mlspace-key-rotation \
  --payload '{"action": "get_status", "secret_arn": "/mlspace/auth/token-encryption-keys"}' \
  response.json && cat response.json
```

### Cleanup Old Versions
```bash
aws lambda invoke \
  --function-name mlspace-key-rotation \
  --payload '{"action": "cleanup_old_versions", "secret_arn": "/mlspace/auth/token-encryption-keys", "keep_versions": 3}' \
  response.json
```

## State Key Rotation (Minimal Impact)

### Rotate via Deployment
```bash
cdk deploy
```

## Emergency Procedures

### Immediate Token Key Rotation
```bash
# Rotate immediately (zero user impact)
aws lambda invoke \
  --function-name mlspace-key-rotation \
  --payload '{"action": "rotate_token_key", "secret_arn": "/mlspace/auth/token-encryption-keys"}' \
  response.json
```

### Immediate State Key Rotation
```bash
# Deploy new state key (1-2 minute impact for active logins)
cdk deploy --exclusively
```

## Verification

### Check Token Key Structure
```bash
aws secretsmanager get-secret-value \
  --secret-id /mlspace/auth/token-encryption-keys \
  --query SecretString --output text | jq .
```

### Check State Key
```bash
aws secretsmanager get-secret-value \
  --secret-id /mlspace/auth/state-encryption-key \
  --query SecretString --output text | jq .
```

## Troubleshooting

### Check Rotation Logs
```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/mlspace-key-rotation \
  --start-time $(date -d '1 hour ago' +%s)000
```

### Check Authentication Errors
```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/mlspace-auth-identity \
  --filter-pattern "decryption failed" \
  --start-time $(date -d '1 hour ago' +%s)000
```

## Scheduled Rotation

- **Token Keys**: Automated every 90 days via EventBridge
- **State Keys**: Regenerated on each CDK deployment
- **Manual Override**: Use commands above for immediate rotation