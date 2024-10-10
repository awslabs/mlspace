# MLSpace-app-denied-services

```json:line-numbers
{
    "Version": "2012-10-17",
    "Statement": [
        // when `Amazon Translate real-time` is disabled
        {
            "Effect": "Deny",
            "Action": [
                "translate:TranslateDocument",
                "translate:TranslateText"
            ],
            "Resource": "*"
        },

        // when `Amazon Translate batch` is disabled
        {
            "Effect": "Deny",
            "Action": [
                "translate:StopTextTranslationJob",
                "translate:ListTextTranslationJobs",
                "translate:StartTextTranslationJob",
                "translate:DescribeTextTranslationJob"
            ],
            "Resource": "*"
        },

        // when `Amazon Ground Truth` is disabled
        {
            "Effect": "Deny",
            "Action": [
                "sagemaker:CreateLabelingJob",
                "sagemaker:DescribeLabelingJob",
                "sagemaker:StopLabelingJob",
                "sagemaker:ListLabelingJobs"
            ],
            "Resource": "*"
        },

        // when `Amazon EMR` is disabled
        {
            "Effect": "Deny",
            "Action": [
                "elasticmapreduce:*"
            ],
            "Resource": "*"
        },
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
        },
        {
            "Effect": "Deny",
            "Action": [
                "ec2:AuthorizeSecurityGroupIngress"
            ],
            "Resource": "arn:aws:ec2::012345678910:security-group/*"
        },
        {
            "Effect": "Deny",
            "Action": [
                "ec2:DescribeInstances",
                "ec2:DescribeRouteTables"
            ],
            "Resource": "*"
        },

        // when `Amazon Translate real-time` AND `Amazon Translate batch` is disabled
        {
            "Effect": "Deny",
            "Action": [
                "translate:ListTerminologies",
                "translate:ListLanguages",
                "comprehend:Detect*",
                "comprehend:BatchDetect*"
            ],
            "Resource": "*"
        },
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
    ]
}
```