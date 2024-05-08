---
outline: deep
---

# Configuring a GroundTruth OIDC Workforce using Keycloak
SageMaker GroundTruth supports using an [OIDC based workforce](https://docs.aws.amazon.com/sagemaker/latest/dg/sms-workforce-create-private-oidc.html) for labeling jobs. {{ $params.APPLICATION_NAME }} requires an existing GroundTruth workforce in order to create labeling jobs. This workforce must be created by someone with access to the AWS console and may require additional configuration of the OIDC identity provider. This guide provides the steps necessary to create a private workforce using [Keycloak](https://www.keycloak.org) an open source identity and access management solution.

## Configuring Keycloak
In order to connect an OIDC provider to GroundTruth a [number of claims](https://docs.aws.amazon.com/sagemaker/latest/dg/sms-workforce-create-private-oidc.html#sms-workforce-create-private-oidc-configure-idp) must be provided by the IdP. In Keycloak you can configure the claims at the realm level on the [Client scopes](https://www.keycloak.org/docs/latest/server_admin/#_client_scopes) page. The following scopes will need to be added:

| Name | Description | Example |
|--|--|--|
|`sagemaker:groups` or `sagemaker-groups`| Assigns a worker to one or more groups. Groups are used to map the worker into work teams. | `["teamA", "teamB"]` or `"teamA"`|
|`sagemaker:sub` or `sagemaker-sub`| A unique id to track a worker identity inside the Ground Truth platform for auditing and to identify tasks worked on by that worker.| uuid, userId, etc |
|`sagemaker:client_id` or `sagemaker-client_id`| A client ID. All tokens must be issued for this client ID.| `client-123` |
| `sagemaker:name` or `sagemaker-name` | The worker name to be displayed in the worker portal. | `Jane Doe` |

The `name`, `groups`, and `sub` scopes should all be created using mappers to link the values to existing properties managed within Keycloak. Each of the scopes will also need to have the `Include in token scope` toggle set to `On`.

Once the necessary scopes have been created you will need to add the scopes to the client that you will be using with GroundTruth. Client scopes are managed on the client details page within the Keycloak administrator interface. From the client details page you will need to select the `Client scopes` tab and then the `Add client scope` button. From the modal you'll need to select the required scopes and add them to the client as `Default` scopes. You can validate that the scopes have been correctly configured using the `Evaluate` sub-tab within the `Client scopes` tab in the client details view.

Lastly you will need to update the client configuration to add the GroundTruth redirect URL. This URL will not be visible until after the workteam has been created.

## Creating the workforce
GroundTruth does not support creating OIDC workforces in the AWS console so you will need to create the workforce using the API. Before creating the workforce you will need the following information from your Keycloak instance:

* Client Id - This is the id of the client that you configured prevoiusly in the `Configuring Keycloak` section
* Client Secret - This can be found on the `Credentials` tab in the client details view in keycloak
* Issuer - This can be obtained by navigating to the `Realm settings` page in Keycloak and clicking the `OpenID Endpoint Configuration` link. This will open the OpenID well-known configuration page which includes all of the remaining parameters.
* Authorization Endpoint - This can be grabbed from the well-known configuration.
* Token Endpoint - This can be grabbed from the well-known configuration.
* Logout Endpoint - This can be grabbed from the well-known configuration.
* JwksUri - This can be grabbed from the well-known configuration.

The endpoint values all tend to follow a similar format of `https://<hostname>/realms/<realmname>/protocol/openid-connect/<resource>`. Once you've gathered the necessary information you can create a workforce using the following AWS CLI command (this example uses a hostname of `keycloak.mlspace.com` and a realm of `mlspace`):
```
aws sagemaker create-workforce --region us-east-2 \
--workforce-name mlspace-dev --oidc-config '{
"ClientId": "sm-private-workforce",
"ClientSecret": "hfP8v91jNRmcjViBdeAIpt3k0lAxehMw",
"Issuer": "https://keycloak.mlspace.com/realms/mlspace",
"AuthorizationEndpoint": "https://keycloak.mlspace.com/realms/mlspace/protocol/openid-connect/auth",
"TokenEndpoint": "https://keycloak.mlspace.com/realms/mlspace/protocol/openid-connect/token",
"UserInfoEndpoint": "https://keycloak.mlspace.com/realms/mlspace/protocol/openid-connect/userinfo",
"LogoutEndpoint": "https://keycloak.mlspace.com/realms/mlspace/protocol/openid-connect/logout",
"JwksUri": "https://keycloak.mlspace.com/realms/mlspace/protocol/openid-connect/certs"
}'
```

The response will contain a `SubDomain` property, this value will need to be added as a valid redirect URL for the Keycloak client.

Once the workforce has been created it will be visibile on the `Private` tab on the `Lableling workforces` page in the GroundTruth Console in AWS. The `Private workforce summary` will contain the workforce ARN, OIDC client ID, OIDC issuer, workforce status, and a labeling portal URL.

You can validate that the workforce is properly configured by clicking the labeling portal URL. You should be redirected to your Keycloak login page. After authenticating with Keycloak you should then be redirected to the labeling job portal. In the top left of the page you should see the username as defined by the `sagemaker:name` or `sagemaker-name` claim.