---
outline: deep
---

# Configuration

Users with Administrator permission can access {{ $params.APPLICATION_NAME }}’s Configuration page. This page is divided into three sections:

1. Dynamic Configuration
2. Dynamic Configuration History
3. Deployment Configuration

## Dynamic Configuration

Admins can manage several features of {{ $params.APPLICATION_NAME }} without needing to make code changes or redeploy the application. The sections below will explore the different type of features that can be configured.

Using the actions button on the right side of the page, an admin can:

- **Import Configuration**: upload a JSON file with the correct schema and it will be deployed as the current dynamic configuration for {{ $params.APPLICATION_NAME }}.
- **Export Configuration**: downloads a JSON file containing all of the current dynamic condifigurations for {{ $params.APPLICATION_NAME }}. This is useful if making a new deployment of {{ $params.APPLICATION_NAME }} and you wish to re-use the current configurations.
- **Expand All**: expands all collapsed sections on the page so everything is in its expanded state.

At the bottom of this page is a "Save Changes" button. Upon clicking this, the user will be shown a brief summary of the fields that have been changed and will be updated when this new dynamic configuration is uploaded.

### Allowed Instance Types

Modify the Amazon EC2 instance types that you wish to make available to users within the following resources: Notebook instance, Training and HPO jobs, Transform jobs, and Endpoints. IAM permissions that control access to these instance types within the {{ $params.APPLICATION_NAME }} user interface and Jupyter Notebooks will automatically update.

### Activated Services

Activate or deactivate services within {{ $params.APPLICATION_NAME }}. IAM permissions that control access to these services within the {{ $params.APPLICATION_NAME }} user interface and Jupyter Notebooks will automatically update. Deactivated services will no longer appear within the {{ $params.APPLICATION_NAME }} user interface. Deactivating services will terminate all active corresponding jobs and instances associated with the service.

### EMR Config

Configure the settings that EMR Clusters deployed through the {{ $params.APPLICATION_NAME }} user interface are deployed with.

#### Applications

Manage the applications available to EMR clusters that users create through the {{ $params.APPLICATION_NAME }} user interface.

#### Cluster Types

Define or modify the cluster types that user can choose from when they create EMR clusters through the {{ $params.APPLICATION_NAME }} user interface.

#### Auto Scaling Policy

An automatic scaling policy for a core instance group or task instance group in an Amazon EMR cluster. The automatic scaling policy defines how an instance group dynamically adds and terminates Amazon EC2 instances.

### Project Creation

All users can create new projects in {{ $params.APPLICATION_NAME }} by default. Restrict project creation to users with Admin permissions by activating “Admin Only”.

### System Banner

When active, a banner will be displayed along the top and bottom of the {{ $params.APPLICATION_NAME }} user interface. The color of the text and the banner itself can be selected as well.

## Dynamic Configuration History

Admins can see the history of dynamic configurations for {{ $params.APPLICATION_NAME }}. Version 0 is the default configuration deployed with {{ $params.APPLICATION_NAME }}. When an update is made to the dynamic configuration, a new row is created in this table and the Version value is incremented by 1. If at any point an admin wishes to revert to a prior dynamic configuration they can click the "Rollback" for that version, and that version will become the current dynamic configuration for the application.

## Deployment Configuration

Administrators can view the current deployment-time configurations for {{ $params.APPLICATION_NAME }}. If configuration settings need to be changed, a system admin developer will need to make those modifications and redeploy the application.
