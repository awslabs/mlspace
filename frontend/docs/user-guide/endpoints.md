---
outline: deep
---

# Endpoints

Deploy a model using an endpoint configuration for real time inference using SageMaker hosting services.

## Create Endpoint

From the endpoints view within the context of a project, users can create new endpoints by clicking
the "Create endpoint" button. Endpoints must be associated with a single endpoint configuration, you
can choose an existing endpoint or create a new configuration using an embedded form.

## Managing Endpoints

Endpoints can be deleted by the configuration owner, project owners, or system administrators.
Additionally all members of a project can view the endpoint details which will display the endpoint
status, endpoint logs, configuration information pertaining to each of the associated production variants
and, if configured, the associated data capture settings.

If the project owner has configured an endpoint termination time then that will also be viewable under "Endpoint settings" as part of the "Auto-termination time" field. If the user has the necessary permissions and the project owner has configured the project to allow endpoint termination time overrides, then the user will be able to modify the auto-termination time of the endpoint. Termination times are approximate and will execute when the next termination workflow runs at a configured time interval.