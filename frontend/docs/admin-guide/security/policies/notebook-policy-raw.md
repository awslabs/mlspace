{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Condition": {
                "Bool": {
                    "kms:GrantIsForAWSResource": "true"
                }
            },
            "Action": "kms:CreateGrant",
            "Resource": "arn:aws:kms:us-east-1:012345678910:key/80b28a33-4686-4d87-9dda-4a87e889875a",
            "Effect": "Allow"
        },
        {
            "Action": [
                // EC2 permissions required to create hpo/training/transform jobs in a private VPC
                "ec2:CreateNetworkInterface",
                "ec2:CreateNetworkInterfacePermission",
                "ec2:DeleteNetworkInterface",
                "ec2:DeleteNetworkInterfacePermission",

                // KMS permissions are required to encrypt job output and decrypt job input
                "kms:Decrypt",
                "kms:DescribeKey",
                "kms:Encrypt",
                "kms:GenerateDataKey"
            ],
            "Resource": [
                "arn:aws:kms:us-east-1:012345678910:key/80b28a33-4686-4d87-9dda-4a87e889875a",
                "arn:aws:ec2:us-east-1:012345678910:network-interface/*",
                "arn:aws:ec2:us-east-1:012345678910:security-group/sg-0c001c111cbcdcdf6",
                "arn:aws:ec2:us-east-1:012345678910:subnet/subnet-0f9f0555e69d3d687",
                "arn:aws:ec2:us-east-1:012345678910:subnet/subnet-06cbb3ec6591a31ad",
                "arn:aws:ec2:us-east-1:012345678910:subnet/subnet-0c0e994c58823e1c3"
            ],
            "Effect": "Allow"
        },

        // General Permissions - Allows tagging of SageMaker resources created within a notebook
        {
            "Action": "sagemaker:AddTags",
            "Resource": "arn:aws:sagemaker:us-east-1:012345678910:*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "comprehend:BatchDetect*",
                "comprehend:Detect*",
                "ec2:DescribeDhcpOptions",
                "ec2:DescribeNetworkInterfaces",
                "ec2:DescribeSecurityGroups",
                "ec2:DescribeSubnets",
                "ec2:DescribeVpcs",
                "iam:GetRole",
                "cloudwatch:PutMetricData",
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:DescribeLogStreams",
                "logs:PutLogEvents",
                "sagemaker:DescribeWorkteam",
                "sagemaker:ListEndpointConfigs",
                "sagemaker:ListEndpoints",
                "sagemaker:ListHyperParameterTuningJobs",
                "sagemaker:ListLabelingJobs",
                "sagemaker:ListModels",
                "sagemaker:ListTags",
                "sagemaker:ListTrainingJobs",
                "sagemaker:ListTrainingJobsForHyperParameterTuningJob",
                "sagemaker:ListTransformJobs",
                "sagemaker:ListWorkteams",
                "translate:DescribeTextTranslationJob",
                "translate:ListLanguages",
                "translate:ListTerminologies",
                "translate:ListTextTranslationJobs",
                "translate:StartTextTranslationJob",
                "translate:StopTextTranslationJob",
                "translate:TranslateDocument",
                "translate:TranslateText"
            ],
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "Null": {
                    "aws:RequestTag/user": "false",
                    "aws:RequestTag/project": "false"
                }
                "StringEqualsIgnoreCase": {
                    "aws:RequestTag/system": "MLSpace"
                }
            },
            "Action": "sagemaker:CreateEndpoint",
            "Resource": "arn:aws:sagemaker:us-east-1:012345678910:endpoint/*",
            "Effect": "Allow"
        },
        {
            "Action": "sagemaker:CreateEndpoint",
            "Resource": "arn:aws:sagemaker:us-east-1:012345678910:endpoint-config/*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "Null": {
                    "sagemaker:VpcSubnets": "false",
                    "aws:RequestTag/user": "false",
                    "aws:RequestTag/project": "false",
                    "sagemaker:VpcSecurityGroupIds": "false"
                },
                "StringEqualsIgnoreCase": {
                    "aws:RequestTag/system": "MLSpace"
                }
            },
            "Action": "sagemaker:CreateModel",
            "Resource": "arn:aws:sagemaker:us-east-1:012345678910:model/*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "Null": {
                    "aws:RequestTag/user": "false",
                    "aws:RequestTag/project": "false"
                },
                "StringEqualsIgnoreCase": {
                    "aws:RequestTag/system": "MLSpace"
                }
            },
            "Action": "sagemaker:CreateLabelingJob",
            "Resource": "arn:aws:sagemaker:us-east-1:012345678910:labeling-job/*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "Null": {
                    "aws:ResourceTag/project": "false",
                    "aws:ResourceTag/user": "false"
                },
                "StringEqualsIgnoreCase": {
                    "aws:RequestTag/system": "MLSpace"
                }
            },
            "Action": [
                "sagemaker:DeleteEndpoint",
                "sagemaker:DeleteEndpointConfig",
                "sagemaker:DeleteModel",
                "sagemaker:DescribeEndpoint",
                "sagemaker:DescribeEndpointConfig",
                "sagemaker:DescribeHyperParameterTuningJob",
                "sagemaker:DescribeLabelingJob",
                "sagemaker:DescribeModel",
                "sagemaker:DescribeTrainingJob",
                "sagemaker:DescribeTransformJob",
                "sagemaker:InvokeEndpoint",
                "sagemaker:StopHyperParameterTuningJob",
                "sagemaker:StopLabelingJob",
                "sagemaker:StopTrainingJob",
                "sagemaker:StopTransformJob",
                "sagemaker:UpdateEndpoint",
                "sagemaker:UpdateEndpointWeightsAndCapacities"
            ],
            "Resource": "arn:aws:sagemaker:us-east-1:012345678910:*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "s3:GetObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::mlspace-config-012345678910",
                "arn:aws:s3:::mlspace-config-012345678910/*",
                "arn:aws:s3:::mlspace-data-012345678910/global-read-only/*",
                "arn:aws:s3:::sagemaker-sample-files",
                "arn:aws:s3:::sagemaker-sample-files/*"
            ],
            "Effect": "Allow"
        },
        {
            "Condition": {
                "StringLike": {
                    "s3:prefix": "global-read-only/*"
                }
            },
            "Action": "s3:ListBucket",
            "Resource": "arn:aws:s3:::mlspace-data-012345678910",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "Null": {
                    "aws:RequestTag/user": "true",
                    "aws:RequestTag/project": "true",
                    "aws:ResourceTag/user": "true",
                    "aws:ResourceTag/system": "true",
                    "aws:ResourceTag/project": "true",
                },
                "StringNotEqualsIgnoreCase": {
                    "aws:RequestTag/system": "MLSpace"
                }
            },
            "Action": [
                // mutating
                "bedrock:Associate*",
                "bedrock:Create*",
                "bedrock:BatchDelete*",
                "bedrock:Delete*",
                "bedrock:Put*",
                "bedrock:Retrieve*",
                "bedrock:Start*",
                "bedrock:Update*",
                
                // non-mutating
                "bedrock:Apply*",
                "bedrock:Detect*",
                "bedrock:List*",
                "bedrock:Get*",
                "bedrock:Invoke*",
                "bedrock:Retrieve*",
            ],
            "Resource": "arn:aws:sagemaker:us-east-1:012345678910:*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "StringEquals": {
                    "iam:PassedToService": "translate.amazonaws.com"
                }
            },
            "Action": "iam:PassRole",
            "Resource": "arn:aws:iam::012345678910:role/MLSpace*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "Null": {
                    "aws:RequestTag/user": "true",
                    "aws:RequestTag/project": "true"
                },
                "StringNotEqualsIgnoreCase": {
                    "aws:RequestTag/system": "MLSpace"
                }
            },
            "Action": ["sagemaker:CreateEndpointConfig", "sagemaker:CreateTransformJob"],
            "Resource": "arn:aws:sagemaker:us-east-1:012345678910:*",
            "Effect": "Deny"
        },
        {
            "Condition": {
                "Null": {
                    "sagemaker:VpcSubnets": "true",
                    "aws:RequestTag/user": "true",
                    "aws:RequestTag/project": "true",
                    "sagemaker:VpcSecurityGroupIds": "true"
                },
                "StringNotEqualsIgnoreCase": {
                    "aws:RequestTag/system": "MLSpace"
                }
            },
            "Action": [
                "sagemaker:CreateHyperParameterTuningJob",
                "sagemaker:CreateTrainingJob"
            ],
            "Resource": [
                "arn:aws:sagemaker:us-east-1:012345678910:hyper-parameter-tuning-job/*",
                "arn:aws:sagemaker:us-east-1:012345678910:training-job/*"
            ],
            "Effect": "Deny"
        }
    ]
}