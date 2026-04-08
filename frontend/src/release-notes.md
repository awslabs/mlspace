# v1.7.2

This release extends Amazon SageMaker Ground Truth labeling workflows, improves how training job metrics appear in the console, and delivers several reliability fixes raised through customer feedback.

## Changes

* **Ground Truth labeling** 
  * Added support for bounding box verification and semantic segmentation verification jobs, enabling users to verify previously completed labeling jobs.
  * Added support for custom task types via the Custom category, allowing users to provide their own HTML templates for more tailored Ground Truth job configurations.
  * Labeling job details now include a direct link to the Workforce Labeling Portal, giving labelers quick access to the task UI.
* **Workforce labeling portal** — Ground Truth labeling job details include a link to open the **Workforce labeling portal** so labelers can reach the task UI quickly.
* **Training job metrics** — The training job detail page shows **final metric values** (from SageMaker output) in a dedicated table, separate from algorithm **metric definitions** (log regex patterns), with clearer empty and in-progress messaging.

## Bug Fixes

* **Ground Truth private datasets** — The S3 put-notification handler for labeling datasets now infers the creating user from the object key path instead of defaulting to a placeholder user, correcting dataset ownership metadata for private datasets.
* **Dataset scope and S3 URIs** — Fixed S3 URI construction when dataset scope affects naming.
* **Authentication stack and CDK** — Resolved deploy-time setup for versioned authentication secrets (including a dedicated invoker) and related CDK synthesis issues so stacks deploy reliably.

## Documentation

* User guide updates for Ground Truth labeling jobs, including **Custom tasks** and short-lived access for worker instruction images referenced by S3 URIs.

## Acknowledgements

* @Ernest-Gray
* @estohlmann

**Full Changelog**: [v1.7.1…v1.7.2](https://github.com/awslabs/mlspace/compare/v1.7.1...v1.7.2)