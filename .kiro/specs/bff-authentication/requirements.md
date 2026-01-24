# Requirements Document

## Introduction

This feature implements a Backend for Frontend (BFF) authentication pattern to abstract authentication details away from the frontend and centralize authentication handling in the backend. The current system uses direct OIDC authentication in the frontend with PKCE flow, which limits integration with Identity Providers that require client secrets or use SAML protocol. The BFF pattern will enable support for GeoAxis and other enterprise IdPs while providing better security, simplified frontend code, and improved session management by handling all authentication flows server-side.

## Glossary

- **BFF_Service**: The backend service that handles all authentication flows and acts as a proxy between the frontend and Identity Providers
- **Frontend_Client**: The React application that will use session-based authentication instead of direct OIDC tokens
- **Identity_Provider**: The external authentication provider (OIDC, SAML, or custom) configured for the deployment
- **Session_Store**: The DynamoDB table that stores session information and IdP response data
- **Auth_Handler**: The Lambda functions that handle IdP-specific authentication protocols (oidc-handler, saml-handler, custom-handler)
- **Legacy_Authorizer**: The existing Lambda authorizer that will be updated to validate session cookies instead of OIDC tokens
- **MLSpace_Session**: The session object that contains user identity and authentication state
- **OTAC**: One Time Authentication Code used for cross-domain cookie synchronization

## Requirements

### Requirement 1

**User Story:** As a frontend developer, I want the authentication complexity abstracted away from the client, so that I can focus on application features without managing IdP-specific protocols directly.

#### Acceptance Criteria

1. WHEN the Frontend_Client loads, THE BFF_Service SHALL handle all Identity_Provider authentication flows without exposing tokens to the browser
2. WHEN a user initiates login, THE system SHALL redirect to /auth/login endpoint which handles Identity_Provider redirection
3. WHEN authentication is successful, THE BFF_Service SHALL establish a secure session using HTTP-only cookies
4. WHEN the Frontend_Client makes API requests, THE Legacy_Authorizer SHALL validate session cookies and provide authentication context
5. WHEN a user logs out, THE /auth/logout endpoint SHALL invalidate the session and clear all authentication state

### Requirement 2

**User Story:** As a security administrator, I want all authentication tokens to be handled server-side, so that sensitive credentials are never exposed to the browser environment.

#### Acceptance Criteria

1. WHEN Identity_Provider tokens are received, THE Auth_Handler SHALL store them securely in Session_Store with appropriate TTL
2. WHEN the Frontend_Client communicates with the backend, THE system SHALL use HTTP-only, Secure cookies containing session identifiers only
3. WHEN tokens need refreshing, THE system SHALL handle refresh flows transparently during /auth/identity calls
4. WHEN sessions expire, THE /auth/identity endpoint SHALL return HTTP 401 with UNAUTHENTICATED status
5. WHEN storing session data, THE Session_Store SHALL use DynamoDB encryption at rest and separate raw IdP data from processed session objects

### Requirement 3

**User Story:** As a system architect, I want the BFF to integrate seamlessly with existing backend services, so that current functionality remains unchanged during the transition.

#### Acceptance Criteria

1. WHEN the Legacy_Authorizer receives requests, THE system SHALL validate session cookies and retrieve user information from Session_Store
2. WHEN processing authenticated requests, THE Legacy_Authorizer SHALL populate the same authContext structure that existing Lambda functions expect
3. WHEN user information is needed, THE system SHALL provide the same user data format that current APIs consume
4. WHEN the system processes API requests, THE existing Lambda functions SHALL continue to work without modification
5. WHEN deploying authentication, THE system SHALL support configuration-based selection of authentication method (legacy OIDC, BFF with OIDC, BFF with SAML, BFF with custom)

### Requirement 4

**User Story:** As a user, I want seamless authentication experience with automatic session management, so that I don't have to repeatedly log in or manage tokens manually.

#### Acceptance Criteria

1. WHEN a user's session is valid, THE Frontend_Client SHALL automatically include session cookies in all API requests
2. WHEN a session expires, THE /auth/identity endpoint SHALL attempt automatic token refresh based on Identity_Provider refresh token capabilities before requiring re-authentication
3. WHEN automatic refresh fails, THE system SHALL return UNAUTHENTICATED status and redirect the user to /auth/login
4. WHEN a user closes and reopens the application, THE system SHALL maintain their authenticated session using persistent HTTP-only cookies
5. WHEN multiple browser tabs are open, THE system SHALL synchronize authentication state using MessageChannel API for real-time cross-tab communication

### Requirement 5

**User Story:** As a developer, I want comprehensive session management APIs, so that I can build robust authentication flows and handle edge cases properly.

#### Acceptance Criteria

1. WHEN checking authentication status, THE /auth/identity endpoint SHALL return current session state with user information or UNAUTHENTICATED status
2. WHEN session validation occurs, THE /auth/identity endpoint SHALL return user displayName, email, and other identity attributes in consistent JSON format
3. WHEN errors occur during authentication, THE /auth/callback endpoint SHALL handle failures gracefully and redirect with appropriate error messaging
4. WHEN debugging authentication issues, THE Auth_Handler functions SHALL provide comprehensive logging without exposing sensitive IdP tokens
5. WHEN monitoring system health, THE system SHALL log authentication success rates and session management metrics to CloudWatch

### Requirement 6

**User Story:** As a system administrator, I want configurable session management and IdP integration, so that I can tune security parameters and support multiple Identity Providers based on organizational requirements.

#### Acceptance Criteria

1. WHEN configuring session duration, THE Session_Store SHALL use TTL values based on Identity_Provider token expiration with configurable default fallback values
2. WHEN setting cookie security, THE system SHALL enforce Secure and SameSite=Strict flags on all session cookies
3. WHEN configuring Identity Providers, THE system SHALL support multiple Auth_Handler implementations (OIDC, SAML, custom) based on deployment configuration
4. WHEN handling cross-domain deployments, THE system SHALL support OTAC-based cookie synchronization across different domains
5. WHEN managing session cleanup, THE Session_Store SHALL automatically expire session records based on TTL and support manual session invalidation

### Requirement 7

**User Story:** As an integrator, I want support for enterprise Identity Providers that require client secrets or SAML protocol, so that I can integrate MLSpace with organizational authentication systems like GeoAxis.

#### Acceptance Criteria

1. WHEN configuring OIDC authentication, THE oidc-handler SHALL support both PKCE flow (current) and authorization code flow with client secrets
2. WHEN integrating with SAML providers, THE saml-handler SHALL process SAML assertions and extract user identity information
3. WHEN using custom authentication protocols, THE custom-handler SHALL provide extensible integration points for customer-specific implementations
4. WHEN processing IdP responses, THE Auth_Handler SHALL extract and normalize user identity data into the MLSpace_Session format
5. WHEN handling IdP-specific errors, THE system SHALL provide appropriate error handling and logging for each authentication protocol