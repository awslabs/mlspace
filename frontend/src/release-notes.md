# v1.6.11

## Features
* **Bedrock IAM Policies**: Updated existing IAM policies to address Amazon Bedrock API updates. MLSpace customers can continue to directly call service APIs directly from their notebooks, enabling seamless integration with Bedrock’s foundation models and generative AI capabilities.

## Documentation
* Updated Bedrock policy documentation to reflect updated IAM policies.
* Added an updated detailed architecture diagram to showcase MLSpace’s infrastructure and component relationships.
* Expanded documentation to cover how MLSpace stores auditable logs, providing greater transparency into logging mechanisms.

 ## Upcoming
* **Bedrock VPC Endpoints**: Addition of a VPC endpoint for Amazon Bedrock to ensure traffic remains private within the customer's AWS network for enhanced security.
* **Bedrock Configuration Parameter**: New configuration parameter to allow customers to disable Bedrock capabilities in notebooks if desired.
* **GroundTruth Label Verification**: Addition of GroundTruth Label Verification jobs to the UI, enabling users to review and validate labeled data directly from the MLSpace interface.

## Acknowledgements

* @bedanley
* @dustins
* @estohlmann
* @jmharold

**Full Changelog**: [v1.6.10...v1.6.11](https://github.com/awslabs/mlspace/compare/v1.6.10...v1.6.11)