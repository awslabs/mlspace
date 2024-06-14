---
outline: deep
---

# Gound Truth Labeling Jobs

Ground Truth helps you build high-quality training datasets for your machine learning models. With Ground Truth in {{ $params.APPLICATION_NAME }}, you can use workers from an internal, private workforce along with machine learning to enable you to create a labeled dataset. You can use the labeled dataset output from Ground Truth to train your own models. You can also use the output as a training dataset for an Amazon SageMaker model.

## Create a Labeling Job

All labeling jobs in {{ $params.APPLICATION_NAME }} must be associated with a project. From the labeling jobs list within the context of a project, users can create new labeling jobs by clicking the "Create new labeling job" button. Labeling job creation is presented as a multi-step workflow with both required and optional settings. Before creating a new labeling job, you will need access to a private workforce. For assistance, reach out to an {{ $params.APPLICATION_NAME }} Administrator. You will reference this workforce in step 2 of the multi step workflow.

In the first step of the workflow, input the Amazon S3 bucket URI where the manifest file is stored and configure the parameters for the job. For more information about storing data in an Amazon S3 bucket through {{ $params.APPLICATION_NAME }}, see [Create a Dataset](./datasets.html#create-a-dataset).

- Manifest files are in JSON lines format where each line is a complete JSON object representing the labeling information for an image. There are different formats for image classification and image segmentation. Manifest files must be encoded using UTF-8 encoding.
- Documentation for manifest files can be found [here](https://docs.aws.amazon.com/lookout-for-vision/latest/developer-guide/manifest-files.html).

In the Job overview section, provide the following information:

- Job name – Give the labeling job a name that describes the job. This name will be shown in your Project’s labeling job list. The name must be unique in your account in an AWS Region. Project members can view all of the labeling jobs created in that project.
- Label attribute name – (Optional) This is the key where your labels are stored in the augmented manifest. Ground Truth uses the labeling job name as the default label attribute name. An augmented manifest file contains metadata about your dataset. Read more about augmented manifest files [here](https://docs.aws.amazon.com/sagemaker/latest/dg/augmented-manifest.html#Augmented%20Manifest%20File%20Format).
- S3 location for input datasets – This is the location in S3 where your dataset objects are stored. Ground Truth will use all data objects in this location for your labeling job.
- S3 location for output datasets – The location where your output data is stored in S3.

In the Task type section, provide the following information:

- Task category – Use the drop down menu to select Image or Text. Ground Truth will use all images found in the S3 manifest for input datasets as input for your labeling job.
- Task selection – Select one of the tiles to use the supported task types.

Choose Next to move on to configuring your labeling job.

In the second step of the workflow, choose a workforce for labeling your dataset and give instructions to your workers. In {{ $params.APPLICATION_NAME }}, private workforces are referred to as Labeling teams. A private workforce is required to use Amazon SageMaker Ground Truth. For assistance with creating a new workforce, reach out to an {{ $params.APPLICATION_NAME }} Administrator. The [Create and Manage Workforces](https://docs.aws.amazon.com/sagemaker/latest/dg/sms-workforce-management.html) documentation can be used for reference.

In the Workers section, provide the following information:

- Labeling team – Use the drop down menu to select the private workforce you want to use to perform the labeling job.
- Task timeout – The maximum time a worker can work on a single task.
- Task expiration time – The amount of time that a task remains available to workers before expiring.
- Number of workers per dataset object – The number of distinct workers you want to perform the same task on a dataset object. This can help increase the accuracy of the data labels. Expand the Additional configuration section to modify the number of workers.

In the Label verification tool section, provide the following information:

- Description – Provide a description for the purpose of this job.
- Labels – Provide category names for the objects that the worker should identify.
- Short instructions – Provides instructions that are displayed on the page with the image that your workers are labeling.
- Full instructions – Provides more detailed instructions for your workers. Expand the Additional instructions section to include full instructions.

Both instructions areas are rich text editors enabling you to format your instructions in an organized and clean way. You can also add links and images to your instructions. To add a link, highlight the text you want to turn into a hyperlink and select the link icon. When you add an image by selecting the image icon, a tooltip will pop up allowing you to include a URL or an S3 URI to an image. When adding a S3 URI, enter `{{ 'https://s3.amazonaws.com/your-bucket-name/image-file-name' | grant_read_access }}`. This renders the image URL with a short-lived, one-time access code appended so the worker's browser can display it.