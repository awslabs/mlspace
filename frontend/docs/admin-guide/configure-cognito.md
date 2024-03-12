---
outline: deep
---

# Using AWS Cognito with MLSpace
MLSpace requires an OIDC IdP, if you don't have an existing IdP to integrate with you can setup a new
Cognito User Pool or, if you are already using Cognito, you can create a new application integration
for your existing user pool.

## Creating a new Cognito User Pool to use with MLSpace
You can use the AWS console to create a new Cognito user pool. You can configure the pool however you want but a minimal solution for internal testing and demo purposes can be achieved with the following configuration:

* Step 1 - Allow users to sign-in with a preferred username
* Step 2 - Use the default password policy and optionally enable MFA, do not allow self-service user account recovery
* Step 3 - Do not allow self-registration, disable cognito assisted verification, for required attributes select email, name, and preferred_username
* Step 4 - Send email with Cognito (we’re not allowing self-service so we won’t be sending any emails besides the initial account creation notification)
* Step 5 - Enter a user pool name ie `mlspace-test`, check the box to use the "Cognito Hosted UI", enter a value for a Cognito domain. Select "Public Client", for the initial app client. Enter whatever name you choose ie `mlspace-web-app`, do not generate a client secret, enter a temporary callback URL (the value does not matter and this will be changed once we deploy MLSpace). Scroll down to OpenID Connect scopes and add the Profile scope.
* Step 6 - Review and create

At this point you can follow the instructions in the “Connecting to an existing Cognito User Pool” section to connect your newly created User Pool to MLSpace.

## Connecting to an existing Cognito User Pool

In order to connect MLSpace to an existing cognito user pool you will need the following information:

* User pool ID - this value is visible in the AWS console when viewing the user pool details page as shown in the screenshot below:

![Cognito User Pool properties](../img/cognito/user-pool.png)

* Client ID - If you already have an existing app client for your user pool that is configured for OIDC you can view this value on the app client details page as shown in the screenshot below:

![Cognito App Integration properties](../img/cognito/app-integration.png)

Once you have those two values you can update the `constants.ts` file in the `lib/` application source directory. The Cognito Client ID value will need to be used for `OIDC_CLIENT_NAME` ie:
```javascript
    export const OIDC_CLIENT_NAME = '7sm0a9nvvurn0guite1f2jgqi9';
```
The value for User Pool ID should be combined with the correct region endpoint from https://docs.aws.amazon.com/general/latest/gr/cognito_identity.html to form the `OIDC_URL`. In the example above the User pool exists in the `us-east-2` region so the full endpoint would be `https://cognito-idp.us-east-2.amazonaws.com/us-east-2_oUmWoN1YP`. In the `constants.ts` file this endpoint should be assigned to the `OIDC_URL` variable:
```javascript
export const OIDC_URL = 'https://cognito-idp.us-east-2.amazonaws.com/us-east-2_oUmWoN1YP';
```

Once both values have been updated you can build and deploy MLSpace and it will use Cognito as the IdP. Once MLSpace is deployed you will have to update your Cognito app client to add the MLSpace API Gateway endpoint to the list of "Allowed callback URLs". You can do this by navigating to the App Client details page, scrolling down to hosted UI and clicking the edit button. From there you will need to add your custom domain or the MLSpace API Gateway endpoint the URL list. If you aren't using a custom domain that value should be something similar to `https://<api id>.execute-api.<region>.amazonaws.com/Prod`.

## Troubleshooting

* If you login to cognito but it doesn’t redirect you to MLSpace but rather a cognito hosted error page you can check if the URL includes a reason for the failure (typically `redirect_mismatch`).
* If you login to Cognito and get redirected to MLSpace but do not see your name in the top right on the `Greetings !` button then you’re missing a required `name`` parameter in your OIDC profile
* You can use your browser's dev tools to check if the `POST /user` request is failing. Failing calls to `GET /currentUser` are expected until the user exists

