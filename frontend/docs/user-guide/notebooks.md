---
outline: deep
---

# Notebooks

{{ $params.APPLICATION_NAME }} allows users to spin-up SageMaker notebook instances within {{ $params.APPLICATION_NAME }} projects. An Amazon SageMaker
notebook instance is a machine learning compute instance running the Jupyter Notebook App. Jupyter is an
open-source web application that allows you to create and share documents that contain live code, equations,
visualizations and narrative text. Uses include: data cleaning and transformation, numerical simulation,
statistical modeling, data visualization, machine learning, and much more. With respect to code, it can be
thought of as a web-based IDE that executes code on the server it is running on rather than locally.

## Create a Notebook Instance

All notebook instances in {{ $params.APPLICATION_NAME }} must be associated with a project. After navigating to the notebook
list within the context of project you can create a notebook by clicking the "Create notebook instance"
button in the top right of the table.

When creating a notebook instance you'll need to provide a name, select an instance type, and optionally attach
the notebook instance to an existing EMR cluster.

In order for a notebook instance to be attached to an EMR cluster, the EMR cluster must be in the "WAITING" state and
be part of the same project as the notebook instance being created. If the EMR cluster is in any other state,
it will not be available in the EMR cluster selection menu.

If a notebook stop time has been configured by the project owner then that will also be visible in the
"Notebook instance settings" section. This will be the daily stop time when {{ $params.APPLICATION_NAME }} will automatically
stop all active notebooks in the project. If the project owner has enabled the notebook stop time override
option then a user will be able to modify this stop time when creating or updating a notebook. Stop times are
approximate and will execute when the next stop workflow runs at a configured time interval.

There are also advanced configuration options available to
set the notebook volume size as well as to select from a list of available lifecycle configs. These
configurations are managed externally to {{ $params.APPLICATION_NAME }} and will vary depending on your specific installation.

## Manage a Notebook Instance

Owners of a notebook instance can start, stop, update, delete, and launch jupyter for notebook instance
from their personal notebook list accessed by clicking "Notebooks" under "My Resources" on the left
sidebar navigation.	Projects also contain a notebook list that will include all notebooks associated
with that project. {{ $params.APPLICATION_NAME }} administrators can stop, delete, and update existing notebook instances.
Additionally project owners can stop, delete, and update any notebooks associated with the project
for which they are an owner. All of these actions can be taken from the notebook list or from the
notebook details view.

The notebook details view allows you to review the metadata associated with a notebook instance including
the platform, owner, current status (and error details if applicable), and logs for the notebook instance.

If a notebook instance is in a "Stopped" state then a user with the necessary permissions can edit the notebook instance.

From the Update interface a user can change the notebook instance type or attach the notebook instance
to an EMR cluster. In order for a notebook instance to be attached to an EMR cluster, the EMR cluster must be
in the "WAITING" state and be part of the same project as the notebook instance being created.
If the EMR cluster is in any other state, it will not be available in the EMR cluster selection menu.

If the project owner has configured an automatic stop time for notebook instances in the project,
this will be viewable under the "Auto stop time" field of the "Notebook instance settings".

If the user has the necessary permissions and the project owner has configured the project to allow
notebook stop time overrides, then the user will be able to modify the auto-stop time of the notebook.
Stop times are approximate and will execute when the next stop workflow runs at a configured time interval.

### Creating Resources In A Notebook

When using a Sagemaker Notebook instance users can only create resources if they use the proper tags that allow
them to be tracked by {{ $params.APPLICATION_NAME }}. Failure to use the proper tags will result in an explicit deny error.

Tags must be applied when creating the following resources within a notebook instance:

- Model
- Endpoint Config
- Endpoint
- EMR Cluster
- Training Job
- HPO Tuning Job
- Transform Job

When creating these resources, the following tags must be added:

```python
# Set the user and project variables
user = 'CHANGE_ME_TO_USERNAME'
project = 'CHANGE_ME_TO_PROJECT_NAME'

# Example list of tags to include in resource creation calls by passing in as a parameter
tags = [
    {
        "Key": "project",
        "Value": project
    },
    {
        "Key": "system",
        "Value": "MLSpace"
    },
    {
        "Key": "user",
        "Value": user
    }
]
```

Then these tags must be included when creating the resource, for example:

```json
sagemaker_boto_client.create_model(
    ModelName='...',
    Containers=[...],
    InferenceExecutionConfig={...},
    ExecutionRoleArn='...',
    // Using the tags created above
    Tags=tags,
    VpcConfig={...},
)
```

Additionally, some resources require a proper KMS key and VPC config. These can be retrieved from the Sagemaker
notebook parameters file like in the example below.

```python
# Read in the notebook parameters file
with open ('/home/ec2-user/SageMaker/global-resources/notebook-params.json', 'r') as fh:
    input_data = fh.read()
    sagemaker_parameters = json.loads(input_data)

# Set variables for SageMaker API requests
bucket = sagemaker_parameters['pSMSDataBucketName']
subnets = sagemaker_parameters['pSMSSubnetIds'].split(',')
kms_cmk = sagemaker_parameters['pSMSKMSKeyId']
sg_id = sagemaker_parameters['pSMSSecurityGroupId']
project_prefix = 'project/' + project + '/datasets'
vpc_config = {
    "SecurityGroupIds": sg_id,
    "Subnets": subnets
}
```

See the {{ $params.APPLICATION_NAME }} example notebook “xgboost_mnist.ipynb” for reference. It can be found under the “global-resources” folder.

## Additional documentation

- [Jupyter Notebooks](https://jupyter-notebook.readthedocs.io/en/latest/)
- [Jupyter Lab](https://jupyterlab.readthedocs.io/en/stable/)
- [Amazon Sagemaker Notebook Instances](https://docs.aws.amazon.com/sagemaker/latest/dg/nbi.html)
