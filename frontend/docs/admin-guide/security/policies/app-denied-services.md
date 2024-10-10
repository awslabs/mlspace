# App Denied Services Policy

---

The app denied services policy serves as the policy to activate or deactivate services through the admin configuration management UI. When a service is disabled the corresponding deny statement(s) is added to this policy, when a service is enabled, that deny statement(s) is removed from this policy.

> [!IMPORTANT]
> The policy example provided below is based on a default installation in the US East 1 region. It is broken down statement by statement for clarity. If you intend to use these statements or the full policy at the end of the page, please ensure that you adjust the partition, region, account ID, and resource names to match your specific installation. This example is intended for informational purposes only and should not be implemented without proper customization.

---

## Statement 1

Added to the policy when `Amazon Translate real-time` is disabled.

```json:line-numbers
    {
      "Effect": "Deny",
      "Action": [
        "translate:TranslateDocument",
        "translate:TranslateText"
      ],
      "Resource": "*"
    }
```

## Statement 2

Added to the policy when `Amazon Translate batch` is disabled.

```json:line-numbers
    {
      "Effect": "Deny",
      "Action": [
        "translate:StopTextTranslationJob",
        "translate:ListTextTranslationJobs",
        "translate:StartTextTranslationJob",
        "translate:DescribeTextTranslationJob"
      ],
      "Resource": "*"
    }
```

## Statement 3

Added to the policy when `Amazon EMR` is disabled.

```json:line-numbers
    {
      "Effect": "Deny",
      "Action": [
        "elasticmapreduce:*"
      ],
      "Resource": "*"
    }
```

## Statement 4

Added to the policy when `Amazon EMR` is disabled.

```json:line-numbers
    {
      "Effect": "Deny",
      "Action": [
        "iam:PassRole",
        "iam:ListRoleTags"
      ],
      "Resource": [
        "arn:aws:iam::012345678910:role/EMR_EC2_DefaultRole",
        "arn:aws:iam::012345678910:role/EMR_DefaultRole"
      ]
    }
```

## Statement 5

Added to the policy when `Amazon EMR` is disabled.

```json:line-numbers
    {
      "Effect": "Deny",
      "Action": [
        "ec2:AuthorizeSecurityGroupIngress"
      ],
      "Resource": "arn:aws:ec2::012345678910:security-group/*"
    }
```

## Statement 6

Added to the policy when `Amazon EMR` is disabled.

```json:line-numbers
    {
      "Effect": "Deny",
      "Action": [
        "ec2:DescribeInstances",
        "ec2:DescribeRouteTables"
      ],
      "Resource": "*"
    }
```

## Statement 7

Added to the policy when `Amazon Translate real-time` and `Amazon Translate batch` are disabled.

```json:line-numbers
    {
      "Effect": "Deny",
      "Action": [
        "translate:ListTerminologies",
        "translate:ListLanguages",
        "comprehend:Detect*",
        "comprehend:BatchDetect*"
      ],
      "Resource": "*"
    }
```

## Statement 8

Added to the policy when `Amazon Translate real-time` and `Amazon Translate batch` are disabled.

```json:line-numbers
    {
      "Effect": "Deny",
      "Action": "iam:PassRole",
      "Resource": "arn:aws:iam::012345678910:role/MLSpace*",
      "Condition": {
        "StringEquals": {
          "iam:PassedToReception": "translate.amazonaws.com"
        }
      }
    }
```

## Full Policy

<<< ./app-denied-services-raw.json
