# v1.6.10

## Security

* **Default VPC Endpoints**: When MLSpace provisions a VPC, it now automatically includes endpoints for **Amazon Translate** and **Amazon EMR**, ensuring that traffic to these AWS services remains private within the AWS network.
* **DynamoDB Encryption with KMS**: MLSpace now encrypts DynamoDB tables using a **customer-managed KMS key (CMK)** if provided, giving customers direct control over encryption. This behavior is enabled by default and can be disabled by setting the `ENABLE_DDB_KMS_CMK_ENCRYPTION` flag to **false**.
* Updated dependencies with the latest security patches.

## Bug Fixes

* Fixed an issue affecting GovCloud partition handling.

## Special Thanks

* 🎉 Special thanks to [@szotrj](https://github.com/awslabs/mlspace/pull/318) for contributing their first PR!

## Acknowledgements

* @bedanley
* @dustins
* @estohlmann

**Full Changelog**: [v1.6.9...v1.6.10](https://github.com/awslabs/mlspace/compare/v1.6.9...v1.6.10)