---
outline: deep
---

# Training Jobs

Once data has been uploaded, users can review navigate to the training jobs page within a project.
The training jobs page will list completed and in-progress jobs as well as allow users to take various
actions against those jobs including creating new jobs, viewing details for existing jobs and stopping
running jobs.

## Create a Training Job

From the training jobs dashboard users can create new training jobs by selecting the resources to allocate,
choosing an algorithm, providing hyperparameters, identify the data channels, and submitting a training
job. Amazon SageMaker, on the backend, provisions the resources required for training, and
simply lets the user know when it’s done!

### Custom Algorithm

When creating training jobs you can choose from a built-in alogorithm or to bring your own algorithm from ECR. When
using a custom algorithm you will need to define metric definitions as well as hyper parameters when creating the
training job. Using a custom algorithm will require that {{ $params.APPLICATION_NAME }} has been configured to allow access to ECR.

## Training Job details

The details view for training jobs allows you to review the settings used to create the job including,
the algorithm, hyperparameters, input data, and the dataset/path where the training job results will
be stored.

The "Create model" button will lead to the create model form and pre-populate it
with the algorithm and training data output folder from the training job.

The details view also allows you to view the logs associated with the training job run.
