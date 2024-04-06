---
outline: deep
---

# Models
SageMaker will bundle artifacts and images to provide a modular and deployable representation of a
model for inference. Once models have been created in {{ $params.APPLICATION_NAME }} you can leverage those models in
inference endpoints. The models page within a project will display a list of all models associated
with a project as well as allow project members to create new models and take actions against
existing models.

## Creating Models
Creating models requires a providing model metadata, some of which is optional. A model name and inference
image is required. The inference image location can be selected from a set of built-in SageMaker inference images or
you can optionally specify a custom path to an ECR image. In order to use a custom image your administrator must have configured {{ $params.APPLICATION_NAME }} to allow access ECR and the image being used. Model artifacts and container host name are optional as well as any environment key-value pairs which may be required by the particular model.

## Model Details
The model details view displays the metadta associated with existing models

## Deleting Models
Model owners, project owners, and admins can delete models.