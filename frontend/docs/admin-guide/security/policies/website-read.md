# S3 Reader Policy

---

The S3 Reader policy provides read access to the bucket hosting the static files of the MLSpace website.

---

## Statement 1

This statement grants a role permission to read all objects within the MLSpace website bucket, enabling access to static files.

```json
    {
        "Action": "s3:GetObject",
        "Resource": "arn:aws:s3:::mlspace-website-012345678910/*",
        "Effect": "Allow"
    }
```

## Full Policy

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::mlspace-website-012345678910/*",
            "Effect": "Allow"
        }
    ]
}
```