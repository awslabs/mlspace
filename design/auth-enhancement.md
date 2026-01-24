MLSpace Auth Enhancement

Executive summary/Purpose

Since MLSpace's launch, a recurring topic in conversations with current and prospective integrators has been the ability to integrate with Identity Providers (IdPs) using authentication schemes that are not currently supported. These integrators have identified significant pain points stemming from their inability to connect MLSpace to IdPs that exclusively support the SAML protocol or OIDC authentication flows requiring secret keys not designed for Single Page Applications (SPAs).

While MLSpace currently supports the most common OIDC authentication flow for SPAs using PKCE (Proof Key Code Exchange), the original decision to support a single authentication scheme—which enabled rapid deployment with broad compatibility—has become one of the primary sources of integration friction for GeoAxis customers. Geoaxis is a popular IdP for DoD customers. Three, soon to be four, MLSpace customers use GeoAxis today.

Proposal

This solution overhauls the current authentication architecture by introducing a Backend for Frontend (BFF) pattern that abstracts authentication details from the frontend SPA and manages IdP integration directly on the backend. This new abstraction layer will significantly enhance MLSpace's flexibility regarding IdP selection and integration methods by establishing a frontend facade supported by an extensible backend architecture. This approach will enable compatibility with previously unsupported IdPs like GeoAxis and future compatibilty with SAML only IdPs like AWS Identity Center, addressing the integration limitations that have been a source of friction for some organizations. The MLSpace development team will create a simplified authentication API for frontend consumption that eliminates all IdP and authentication protocol-specific dependencies, providing a clean, abstracted interface for authentication and credential retrieval.

The enhancement encompasses three primary areas of responsibility: the backend API, frontend modifications, and the new authentication flow that connects these components seamlessly.

Backend API

Endpoint	Description	Payload

/auth/login	
Browser endpoint that initiates the authentication process by redirecting to the configured Identity Provider.	
-

/auth/callback	
Return endpoint where the browser is redirected following authentication attempts (successful or failed) from the Identity Provider.	
-

/auth/logout	
Logout endpoint that terminates the user session by deleting the session cookie, removing the DynamoDB record, and optionally logging out from the Identity Provider.	
-

/auth/identity	
Endpoint for retrieving the current user's identity information and authentication status.	
HTTP 401

{
   "status": "UNAUTHENTICATED"
}

HTTP 200

{
  "status": "AUTHENTICATED",
  "displayName": "kermit",
  "email": "kermit@sesamest.org"
  ...
}

Frontend Changes

The current frontend implementation utilizes a React component that serves as an OIDC identity token context provider, managing the complete authentication lifecycle including automatic redirects to the Identity Provider and seamless access token refresh operations. This component currently handles all OIDC-specific protocol details directly within the browser environment.

The proposed authentication enhancement will replace this OIDC-specific context provider with a new MLSpace Authentication context provider that abstracts away all Identity Provider and protocol-specific complexity. Instead of managing OIDC tokens and flows directly, this new provider will communicate exclusively with the backend authentication API endpoints to determine user authentication status and retrieve identity information.

This architectural shift moves the authentication complexity from the client-side JavaScript environment to the backend infrastructure, where sensitive operations like token storage and IdP communication can be handled more securely. 

The IdP integration code can pick an appropriate period refresh that is provided to the browser as part of the response to /auth/identity. The browser can then periodically refresh this data and allow the backend to optionally synchronize with the IdP to capture any user updates or credential revocations. This enables IdP synchornizations without the complexity of the frontend handling multiple protocols and without the difficulties of backend task scheduling in a serverless environment. 

The new context provider will maintain the same developer experience for other React components that consume authentication state, but will rely on session-based authentication supported by the new backend APIs rather than managing JWT tokens directly in the browser.

Authentication Flow

The new authentication workflow implements a Backend for Frontend pattern that abstracts Identity Provider complexity from the Single Page Application. The flow operates as follows:

1. Authentication Initiation: When the SPA requires authentication, it directs the user to a unified /auth/login endpoint on the MLSpace backend.
2. Identity Provider Redirect: The MLSpace backend redirects the browser to the configured Identity Provider based on the deployment configuration, supporting multiple authentication protocols (SAML, OIDC with client secrets, etc.).
3. Identity Provider Authentication: The user completes authentication with the Identity Provider, which then redirects back to the MLSpace backend at /auth/callback with the appropriate tokens, assertions, or credentials.
4. Credential Storage and Session Management: The MLSpace backend securely stores the IdP-provided tokens and credentials in a DynamoDB table, then issues a session cookie to the SPA containing an identifier that references the stored credential data.
5. Cross-Domain Synchronization (Optional): For multi-domain deployments, the API Gateway backend may redirect to the SPA with an additional One Time Authentication Code (OTAC) to facilitate cookie synchronization across different domains.
6. Secondary Domain Authentication (Optional): The secondary backend validates the OTAC from the query parameters, retrieves the corresponding credential information from DynamoDB, and issues a domain-specific session cookie.




Design details

CDK

A new architectural structure must be implemented to route the appropriate API Gateway resources of  /auth/login and /auth/callback to appropriate Lambda functions for handling IdP specific integration logic. These handlers will manage Identity Provider redirections and extract relevant authentication data from IdP responses and will be wired up based on the updated application configuration that specifies IdP type and protocol specific options.

lambda/
├── auth/
│   ├── oidc-handler.ts
│   ├── saml-handler.ts     (future improvement)
│   └── custom-handler.ts   (customer integration point)

Additionally, a new DynamoDB table is required to store session information, as Identity Provider payloads frequently exceed the 4,096-byte browser cookie limitation and can’t be used for this purpose. This table will serve dual purposes: session management and cookie synchronization. The primary key structure will utilize prefixes to distinguish record types: session: for MLSpace session records and sync: for ephemeral cookie synchronization entries.


PK	TTL	data	raw_data

session:<uuid>	
<expiration-date>	
MLSpace Session Object	
IdP response

sync:<secure-random-key>	
<expiration-date>	
session:<uuid>	

This design enables efficient session lookup while maintaining separation between active user sessions and temporary synchronization tokens used during the authentication flow.

Backend

Initial Impementation

The initial implementation will only provide additional OIDC providers requiring authentication flows not currently unsupported in MLSpace. The Python OAuth/OIDC library authlib has been identified as a low effort way to implement the needed support in the backend for these integrations. 

Additional Work

Several components require development or modification to support the new authentication architecture. The existing authorizer must be updated to validate session cookies rather than OIDC tokens and retrieve user information from DynamoDB to populate the authContext passed to AWS Lambda functions. A new data model representing the MLSpace Session Object will be required, along with a basic repository pattern for persistence operations against the DynamoDB session table. Although not relevant to MLSpace, cookie synchronization functionality may be implemented on a separate domain to accept one-time authentication codes from the browser to generate appropriate session cookies as described in authentication flow steps 5 and 6 above.

Frontend

Implementation Requirements

A new frontend context provider must be developed to retrieve authentication status from the /auth/identity endpoint and provide this information to the application. This provider will handle session expiration notifications and manage authentication redirects as needed.

Compatibility Verification

All existing authentication context usage throughout the application should be audited to ensure continued compatibility with the new authentication model and identify any necessary modifications to maintain functionality.

Alternative Considersations

Additional Browser-based Authentication Protocol Support

One alternative considered was expanding the Single Page Application to support additional authentication protocols directly within the frontend. This approach was ultimately rejected for two primary reasons. First, it would not address the fundamental requirement for integrators who need OIDC flows utilizing client secrets, which are inherently incompatible with browser-based authentication due to security constraints. Second, this approach would substantially increase code complexity and maintenance burden, as each new authentication protocol or Identity Provider implementation would necessitate corresponding changes across both frontend and backend codebases, leading to significant technical debt and reduced maintainability over time.

Store Client Secret in Frontend

While many integrators have worked around client secret limitations by embedding them directly in the frontend code and accepting the security implications of shared client secrets across all users, this solution creates additional challenges. These modifications require maintaining custom patches that complicate keeping MLSpace synchronized with upstream project updates, and this approach only addresses a single unsupported OIDC flow rather than providing a comprehensive authentication framework that can accommodate diverse Identity Provider requirements and security models.
