---
outline: deep
---

# Hyperparameter Tuning Jobs (HPO Jobs)
HPO Jobs allow you to run multiple training jobs to find the best training job parameters.

## Create a Hyperparameter Tuning Job
From the HPO Jobs view within the context of a project, users can create new HPO jobs by clicking the
"Create new HPO job" button. HPO job creation is persented as a multistep wizard with a large number of
both required and optional settings.

The first step of the wizard required filling out basic job metadata including name, tuning strategy,
and whether or not early stopping should be enabled.

The next step in the process involves defining training jobs which will be run as part of the HPO job.
When defining the training jobs you'll need to select one of the available algorithms, define the
hyperparameters, set the objective metric used to determine the best job, and fill in a number of
other required fields. For more information consult the [sagemaker documentation](https://docs.aws.amazon.com/sagemaker/latest/dg/algos.html)
for the specific algorithm you select.

### Custom Algorithm
When defining training jobs you can choose from a built-in alogorithm or to bring your own algorithm from ECR. When
using a custom algorithm you will need to define metric definitions as well as hyper parameters when creating the
definition. Using a custom algorithm will require that {{ $params.APPLICATION_NAME }} has been configured to allow access to ECR.

Once you've defined the training jobs you'll also need to specify the resource configuration for the
HPO job and finally review the job configuration.

## Hyperparameter Tuning Job Details
Once an HPO job completes the results can be viewed by all project users. The details view will show
the status for each of the children training jobs assocaited with the individual HPO job.

In addition to general job details you can also view the configuration for the best training job as
determined by the defined object metrics.

You can also review the definition of each of the training jobs assocaited with the individual HPO job.

