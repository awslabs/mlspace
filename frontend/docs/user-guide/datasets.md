---
outline: deep
---

# Datasets

## Create a Dataset
Global and Private datasets can be created outside the scope of a project by selecting "Datasets"
in the left sidebar navigation. In order to create a project dataset you need to first select a
project using either the project switcher at the top of the left sidebar navigation or by navigating
to the project from the projects dashboard. Once you're on the datasets overview page you can create
a new dataset by clicking the "Create dataset" button in the top right of the table.

In order to create a dataset you'll need to provide the following metadata:

- Name (limited to 255 alphanumeric characters, must be unique within the Global/Private/Project scope)
- Description (limited to 254 alphanumeric characters)
- Type (information purposes only)

_Dataset metadata is purely for informational purposes in order to help other users who may access
the dataset. Selecting a specific type doesn't enforce any restrictions on the data
uploaded to the dataset. Metadata will be stored with the uploaded objects using [S3 object metadata](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingMetadata.html#UserMetadata)._

After filling in the dataset metadata you can upload files using the "Upload file" button in the top
right of the "Files" table. After selecting all the files you'd like to upload click the "Create Dataset"
button which will upload the files to S3 and persist the dataset metadata.

## Managing a Dataset
For global datasets any user in the system can upload additional files but only the owner can update
the dataset metadata. For project datasets any user in the project can upload additional files but
only the dataset owner can update the dataset metadata. Private datasets can only be managed by the
owner/creator. Depending on the privileges a user has on a given dataset the actions available after
selecting the radio button next to the corresponding dataset record in the datasets list page will
vary. Possible actions include Details, Edit, and Delete.

The dataset details view will display the associated metadata as well as a list of files currently
associated with the dataset. Depending on the scope of the dataset and the current users associated
privileges clicking the "Edit" button will allow updating metadata and/or uploading additional files.

### Downloading And Accessing Files
From the file list on the dataset details page, files can be downloaded by clicking on the file name.
The S3 URI can also be copied from the 3rd column in order to reference the file.

### Editing a Dataset
A dataset can be edited by clicking the update button on the details page. From the update form
it is possible to modify the description and it is possible to upload or delete
files from the dataset.

## Deleting a Dataset
Deleting a dataset will remove all files associated with the dataset including any generated data
(training output, etc) associated with the dataset.

## Bring Your Own Data!
Through {{ $params.APPLICATION_NAME }}, users will not have direct console access to Amazon Simple Storage Service (S3).
Instead, users may upload their datasets via the “Bring Your Own Data (BYOD)” console. Users may
select between three levels of privacy for a dataset — global datasets are visible to everyone
registered in the {{ $params.APPLICATION_NAME }} application. Here, one might upload benchmark datasets like SpaceNet or
ImageNet which are open-source and used commonly within the community. Project level datasets are
visible only within the scope of users in a project while private datasets are only visible to individuals.