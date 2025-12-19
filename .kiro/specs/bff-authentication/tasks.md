# BFF Authentication Implementation Plan

This implementation plan breaks down the BFF authentication feature into discrete, manageable tasks. Each task builds incrementally on previous work to implement the Backend for Frontend authentication pattern.

## Implementation Tasks

- [x] 1. Update configuration and constants
  - Update `lib/constants.ts` to add AUTH_* constants and remove legacy OIDC_* constants
  - Update `lib/config.json` with AUTH_* configuration
  - Update `lib/utils/configTypes.ts` to add AUTH_* properties to MLSpaceConfig interface
  - _Requirements: 6.1, 6.3_

- [x] 2. Create DynamoDB session table
  - Add session table creation in the stack where other DynamoDB tables are created
  - Use MLSpace's conditional encryption pattern (KMS if configured, otherwise AWS-managed)
  - Configure TTL attribute for automatic session cleanup
  - Grant Lambda execution role read/write permissions to session table
  - _Requirements: 2.1, 2.5, 6.1_

- [x] 3. Implement backend session management utilities
  - Create `backend/src/ml_space_lambda/auth/session/manager.py` for session CRUD operations
  - Create `backend/src/ml_space_lambda/auth/session/validator.py` for session validation logic
  - Create `backend/src/ml_space_lambda/auth/session/encryption.py` for token encryption using AES-256-GCM
  - Create `backend/src/ml_space_lambda/auth/utils/state.py` for state parameter management
  - Create `backend/src/ml_space_lambda/auth/utils/otac.py` for OTAC generation and validation
  - Create `backend/src/ml_space_lambda/auth/utils/cookies.py` for cookie utilities
  - _Requirements: 2.1, 2.2, 2.5, 6.1_

- [x] 4. Implement OIDC authentication handler
  - Create `backend/src/ml_space_lambda/auth/handlers/base_handler.py` abstract base class
  - Create `backend/src/ml_space_lambda/auth/handlers/oidc_handler.py` using authlib
  - Implement authorization code flow with client secret support
  - Implement token refresh logic
  - Extract and normalize user identity from OIDC tokens
  - _Requirements: 7.1, 7.4_

- [x] 5. Implement /auth/login endpoint
  - Create `backend/src/ml_space_lambda/auth/lambda_functions.py` with `login` handler
  - Generate and encrypt state parameter
  - Set state cookie with appropriate security flags
  - Redirect to OIDC provider with authorization request
  - Handle configuration errors gracefully
  - _Requirements: 1.2, 5.3_

- [x] 6. Implement /auth/callback endpoint
  - Add `callback` handler to `lambda_functions.py` for GET requests
  - Add `callback_post` handler for POST requests (future IdP support)
  - Validate state parameter against state cookie
  - Exchange authorization code for tokens via OIDC handler
  - Create session record in DynamoDB with encrypted tokens
  - Set session cookie with HttpOnly, Secure, SameSite=Strict flags
  - Clear state cookie
  - Check for multi-domain sync configuration and initiate OTAC chain if needed
  - Redirect to final destination or error page
  - _Requirements: 1.3, 2.1, 2.2, 4.4, 6.2, 6.4_

- [ ] 7. Implement /auth/logout endpoint
  - Add `logout` handler to `lambda_functions.py`
  - Validate session cookie
  - Delete session record from DynamoDB
  - Clear session cookie
  - Optionally redirect to IdP logout endpoint
  - _Requirements: 1.5, 5.3_

- [ ] 8. Implement /auth/identity endpoint
  - Add `identity` handler to `lambda_functions.py`
  - Validate session cookie and retrieve session from DynamoDB
  - Check if token refresh is needed based on refreshAt timestamp
  - Attempt token refresh if needed using OIDC handler
  - Return user identity and session information
  - Return 401 UNAUTHENTICATED if session invalid or expired
  - _Requirements: 4.2, 4.3, 5.1, 5.2_

- [ ] 9. Implement /auth/sync endpoint for cross-domain cookie synchronization
  - Add `sync` handler to `lambda_functions.py`
  - Validate OTAC with strong consistency read from DynamoDB
  - Mark OTAC as used with conditional update
  - Retrieve session ID from OTAC record
  - Set session cookie for current domain
  - Generate new OTAC for next domain in chain if applicable
  - Redirect to next domain or final destination
  - _Requirements: 6.4_

- [ ] 10. Register auth endpoints in CDK stack
  - Define `authCommonEnv` and `oidcEnv` environment variable objects
  - Create array of auth endpoint definitions using MLSpacePythonLambdaFunction interface
  - Register each endpoint using `registerAPIEndpoint` utility
  - Set `noAuthorizer: true` for all auth endpoints
  - _Requirements: 1.2, 1.4, 6.3_

- [ ] 11. Update Lambda authorizer to validate session cookies
  - Modify `backend/src/ml_space_lambda/authorizer/lambda_functions.py`
  - Extract session cookie from request headers
  - Validate session from DynamoDB
  - Populate authContext with user information from session
  - Return 401 if session invalid or expired
  - Remove legacy OIDC token validation logic
  - _Requirements: 1.4, 3.1, 3.2, 3.3, 3.4_

- [ ] 12. Update axios-utils to remove Authorization header logic
  - Modify `frontend/src/shared/util/axios-utils.ts`
  - Remove OIDC token extraction from sessionStorage
  - Remove Authorization header setting
  - Add `withCredentials: true` to config for cookie support
  - Keep baseURL, error handling, and project header utilities
  - _Requirements: 1.1, 4.1_

- [ ] 13. Implement frontend AuthContext and AuthProvider
  - Create `frontend/src/contexts/AuthContext.tsx` with AuthUser, AuthSession, AuthState, and AuthContextValue interfaces
  - Implement AuthProvider component with session validation logic
  - Implement checkAuthStatus function to call /auth/identity
  - Implement login function to redirect to /auth/login
  - Implement logout function to call /auth/logout
  - Implement automatic token refresh based on refreshAt threshold
  - Add periodic session validation with configurable interval
  - _Requirements: 1.1, 4.1, 4.2, 4.3, 5.1_

- [ ] 14. Implement cross-tab session synchronization
  - Create AuthSyncManager class using BroadcastChannel API
  - Integrate AuthSyncManager into AuthProvider
  - Broadcast AUTH_STATE_CHANGED when session changes
  - Broadcast SESSION_EXPIRED when session expires
  - Broadcast LOGOUT_INITIATED when user logs out
  - Handle incoming broadcast messages to trigger checkAuthStatus
  - _Requirements: 4.5_

- [ ] 15. Create authentication hooks and utilities
  - Create `useAuth` hook to access AuthContext
  - Create `useUser` convenience hook
  - Create `useAuthStatus` convenience hook
  - Create `useRequireAuth` hook for automatic redirect
  - Create ProtectedRoute component for route-level guards
  - Create AuthLoadingWrapper component for loading states
  - Create SessionExpirationNotice component for expiration warnings
  - _Requirements: 1.1, 4.2, 4.3_

- [ ] 16. Create authentication error boundary
  - Create AuthErrorBoundary component to catch authentication errors
  - Log errors to console and monitoring service
  - Display user-friendly error message with refresh option
  - _Requirements: 5.3_

- [ ] 17. Update application to use new AuthProvider
  - Replace existing OIDC context provider with AuthProvider in app root
  - Wrap application with AuthErrorBoundary
  - Update any components that directly access OIDC context to use new useAuth hook
  - Test authentication flow end-to-end
  - _Requirements: 1.1, 3.5_

- [ ] 18. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 19. Update deployment documentation
  - Document new AUTH_* configuration parameters
  - Document migration steps from legacy OIDC configuration
  - Document SSM parameter setup for client secret
  - Document how to configure multi-domain cookie synchronization
  - _Requirements: 6.3_

- [ ] 20. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
