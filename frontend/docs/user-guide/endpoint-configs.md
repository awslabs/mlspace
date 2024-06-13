---
outline: deep
---

# Endpoint Configurations

Endpoint Configuration are used to define how Amazon SageMaker endpoints should deploy models for
hosted inference. Multiple configurations can leverage the same models or some combination of models.

## Create Endpoint Config

From the endpoint configs view within the context of a project, users can create new endopoint configurations
by clicking the "Create endpoint configuration" button. Endpoint configurations require one or more
associated production variants (models). Each of those variants can also have individual settings configured.
Configurations can also include optional data capture settings. For additional information on endpoint
configurations see the [AWS SageMaker documentation](https://docs.aws.amazon.com/sagemaker/latest/APIReference/API_CreateEndpointConfig.html#API_CreateEndpointConfig_RequestParameters).


### Adding a model

After clicking "Add model" a modal will appear allowing you to pick one of the models associated with the
project. You can add multiple models (or the same model multiple times), remove existing models, and
optionally edit the configuration associated with each variant.

### Editing production variant

Once a model has been associated with a configuration you can edit the specific configuration for that
model, the production variant, by clicking "Edit" in the corresponding row of the table.

## Managing Endpoint Configs

Endpoint configs can be deleted by the configuration owner, project owners, or system administrators.
Additionally all members of a project can view the configuration details which will display information
on the different models being used, the data capture settings if they've been specified, as well as
configuration information for each assocaited production variant.