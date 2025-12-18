# BFF Authentication Design Document

## Overview

This document provides detailed design specifications for implementing the Backend for Frontend (BFF) authentication pattern in MLSpace. The BFF pattern abstracts authentication complexity from the frontend and centralizes all Identity Provider integration in the backend, enabling support for enterprise IdPs that require client secrets or SAML protocol.

## Detailed API Specifications

### Authentication Endpoints

#### POST /auth/login

Initiates the authentication process by redirecting the user to the configured Identity Provider.

**Request:**
```http
POST /auth/login
Content-Type: application/json

{
  "redirectUrl": "https://app.mlspace.com/dashboard" // Optional: where to redirect after auth
}
```

**Response (Redirect):**
```http
HTTP/1.1 302 Found
Location: https://idp.example.com/auth?client_id=...&redirect_uri=...&state=...
Set-Cookie: mlspace_auth_state=<encrypted-state>; HttpOnly; Secure; SameSite=Strict; Max-Age=600
```

**Error Response:**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "INVALID_CONFIGURATION",
  "message": "Identity Provider not configured for this deployment",
  "details": {
    "configuredProvider": null,
    "supportedProviders": ["oidc", "saml"]
  }
}
```

#### GET/POST /auth/callback

Handles the return from Identity Provider after authentication attempt.

**Request (OIDC):**
```http
GET /auth/callback?code=auth_code&state=encrypted_state
Cookie: mlspace_auth_state=<encrypted-state>
```



**Success Response (Single Domain):**
```http
HTTP/1.1 302 Found
Location: https://app.mlspace.com/dashboard
Set-Cookie: mlspace_session=<session-id>; HttpOnly; Secure; SameSite=Strict; Max-Age=86400
Set-Cookie: mlspace_auth_state=; HttpOnly; Secure; SameSite=Strict; Max-Age=0
```

**Success Response (Multi-Domain Chain):**
```http
HTTP/1.1 302 Found
Location: https://api.mlspace.com/auth/sync?otac=otac_xyz789&next=notebooks.mlspace.com&final=https://app.mlspace.com/dashboard
Set-Cookie: mlspace_session=<session-id>; HttpOnly; Secure; SameSite=Strict; Max-Age=86400
Set-Cookie: mlspace_auth_state=; HttpOnly; Secure; SameSite=Strict; Max-Age=0
```

**Error Response:**
```http
HTTP/1.1 302 Found
Location: https://app.mlspace.com/login?error=authentication_failed&message=Invalid%20credentials
Set-Cookie: mlspace_auth_state=; HttpOnly; Secure; SameSite=Strict; Max-Age=0
```

#### POST /auth/logout

Terminates the user session and optionally logs out from the Identity Provider.

**Request:**
```http
POST /auth/logout
Cookie: mlspace_session=<session-id>

{
  "logoutFromIdp": true // Optional: whether to logout from IdP as well
}
```

**Success Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json
Set-Cookie: mlspace_session=; HttpOnly; Secure; SameSite=Strict; Max-Age=0

{
  "status": "LOGGED_OUT",
  "idpLogoutUrl": "https://idp.example.com/logout?post_logout_redirect_uri=..." // Optional
}
```

**Error Response:**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "INVALID_SESSION",
  "message": "No active session found"
}
```

#### GET /auth/identity

Retrieves current user identity and authentication status.

**Request:**
```http
GET /auth/identity
Cookie: mlspace_session=<session-id>
```

**Authenticated Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "AUTHENTICATED",
  "user": {
    "id": "user123",
    "displayName": "John Doe",
    "email": "john.doe@example.com",
    "groups": ["admin", "data-scientist"],
    "attributes": {
      "department": "Engineering",
      "role": "Senior Developer"
    }
  },
  "session": {
    "expiresAt": "2024-01-15T10:30:00Z",
    "refreshAt": "2024-01-15T09:30:00Z",
    "provider": "oidc"
  }
}
```

**Unauthenticated Response:**
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "status": "UNAUTHENTICATED",
  "error": "SESSION_EXPIRED",
  "message": "Session has expired or is invalid"
}
```

**Token Refresh Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json
Set-Cookie: mlspace_session=<new-session-id>; HttpOnly; Secure; SameSite=Strict; Max-Age=86400

{
  "status": "AUTHENTICATED",
  "user": { /* same as above */ },
  "session": {
    "expiresAt": "2024-01-15T11:30:00Z",
    "refreshAt": "2024-01-15T10:30:00Z",
    "provider": "oidc",
    "refreshed": true
  }
}
```

### Cross-Domain Synchronization Flow

The cross-domain synchronization automatically chains multiple domains after successful authentication, ensuring all configured domains receive session cookies without additional user interaction.

**Authentication Flow with Multi-Domain Sync:**
1. User authenticates on Domain A via `/auth/callback`
2. Domain A creates session and checks configuration for additional sync domains
3. If sync domains exist, Domain A generates OTAC and redirects to first sync domain
4. Each sync domain validates OTAC, sets session cookie, and continues chain
5. Final domain redirects to original destination

**Data Storage Pattern:**
Both sessions and OTAC records use the same DynamoDB table with prefixed keys:
- Session records: `session:<session-id>` → Contains user data and IdP tokens
- OTAC records: `otac:<otac-id>` → Contains reference to original session ID
- All domains set the same `mlspace_session` cookie value (the session ID)
- OTAC records are deleted after single use and have short TTL (5 minutes)

#### Internal: POST /auth/sync/initiate

Called internally by `/auth/callback` when multi-domain sync is configured.

**Internal Request:**
```http
POST /auth/sync/initiate
Content-Type: application/json

{
  "sessionId": "session_abc123",
  "syncDomains": ["api.mlspace.com", "notebooks.mlspace.com"],
  "finalRedirectUrl": "https://app.mlspace.com/dashboard"
}
```

**Internal Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "otac": "otac_xyz789",
  "chainUrl": "https://api.mlspace.com/auth/sync?otac=otac_xyz789&next=notebooks.mlspace.com&final=https://app.mlspace.com/dashboard",
  "expiresAt": "2024-01-15T08:35:00Z"
}
```

#### GET /auth/sync

Handles OTAC validation and cookie synchronization in the domain chain.

**Request:**
```http
GET /auth/sync?otac=otac_xyz789&next=notebooks.mlspace.com&final=https://app.mlspace.com/dashboard
```

**Success Response (Continue Chain):**
```http
HTTP/1.1 302 Found
Location: https://notebooks.mlspace.com/auth/sync?otac=otac_abc456&final=https://app.mlspace.com/dashboard
Set-Cookie: mlspace_session=<session-id>; HttpOnly; Secure; SameSite=Strict; Max-Age=86400; Domain=api.mlspace.com
```

**Success Response (End Chain):**
```http
HTTP/1.1 302 Found
Location: https://app.mlspace.com/dashboard
Set-Cookie: mlspace_session=<session-id>; HttpOnly; Secure; SameSite=Strict; Max-Age=86400; Domain=notebooks.mlspace.com
```

**Error Response:**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "INVALID_OTAC",
  "message": "One-time authentication code is invalid or expired",
  "details": {
    "otac": "otac_xyz789",
    "domain": "api.mlspace.com"
  }
}
```

### Error Response Schema

All API endpoints follow a consistent error response format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error description",
  "details": {
    // Additional context-specific error information
  },
  "timestamp": "2024-01-15T08:30:00Z",
  "requestId": "req-12345"
}
```

**Common Error Codes:**
- `INVALID_CONFIGURATION`: IdP not properly configured
- `AUTHENTICATION_FAILED`: IdP rejected authentication
- `SESSION_EXPIRED`: User session has expired
- `INVALID_SESSION`: Session cookie is malformed or invalid
- `TOKEN_REFRESH_FAILED`: Unable to refresh IdP tokens
- `INVALID_OTAC`: Cross-domain sync code is invalid
- `INTERNAL_ERROR`: Unexpected server error

### Request/Response Headers

**Security Headers (All Responses):**
```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
```

**CORS Headers (Cross-Origin Requests):**
```http
Access-Control-Allow-Origin: https://app.mlspace.com
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

## Database Schema Design

### DynamoDB Table Structure

**Table Name:** `mlspace-auth-sessions`

**Primary Key:**
- Partition Key: `pk` (String) - Record identifier with type prefix
- No Sort Key needed for this access pattern

**Attributes:**
- `pk` (String) - Primary key with prefixes: `session:<uuid>` or `otac:<uuid>`
- `ttl` (Number) - Unix timestamp for automatic record expiration
- `data` (Map) - Structured session or OTAC data
- `raw_data` (String) - Base64 encoded raw IdP response (sessions only)
- `created_at` (String) - ISO 8601 timestamp
- `updated_at` (String) - ISO 8601 timestamp

### Session Record Schema

**Key Pattern:** `session:<uuid>`

```json
{
  "pk": "session:550e8400-e29b-41d4-a716-446655440000",
  "ttl": 1705312200,
  "created_at": "2024-01-15T08:30:00Z",
  "updated_at": "2024-01-15T08:30:00Z",
  "data": {
    "user": {
      "id": "user123",
      "displayName": "John Doe",
      "email": "john.doe@example.com",
      "groups": ["admin", "data-scientist"],
      "attributes": {
        "department": "Engineering",
        "role": "Senior Developer"
      }
    },
    "session": {
      "provider": "oidc",
      "expiresAt": "2024-01-15T10:30:00Z",
      "refreshAt": "2024-01-15T09:30:00Z",
      "refreshToken": "encrypted_refresh_token",
      "accessToken": "encrypted_access_token",
      "idToken": "encrypted_id_token"
    },
    "metadata": {
      "loginDomain": "app.mlspace.com",
      "syncedDomains": ["api.mlspace.com", "notebooks.mlspace.com"]
    }
  },
  "raw_data": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." // Base64 encoded original IdP response
}
```

### OTAC Record Schema

**Key Pattern:** `otac:<uuid>`

```json
{
  "pk": "otac:123e4567-e89b-12d3-a456-426614174000",
  "ttl": 1705308900,
  "created_at": "2024-01-15T08:30:00Z",
  "data": {
    "sessionId": "session:550e8400-e29b-41d4-a716-446655440000",
    "remainingDomains": ["notebooks.mlspace.com"],
    "finalRedirectUrl": "https://app.mlspace.com/dashboard",
    "usedAt": null // Set when OTAC is consumed
  }
}
```

### TTL Configuration

**Session Records:**
- Default TTL: 24 hours (86400 seconds)
- Extended TTL: Based on IdP refresh token lifetime (up to 7 days)
- Configurable per deployment via environment variables

**OTAC Records:**
- Fixed TTL: 5 minutes (300 seconds)
- Non-configurable for security reasons
- Automatically deleted after single use

### Indexes

**No additional indexes required** - All access patterns use the primary key:
- Session lookup: `session:<session-id>`
- OTAC validation: `otac:<otac-id>`
- DynamoDB handles TTL cleanup automatically

### Query Patterns and Performance

#### Primary Access Patterns

1. **Session Validation** (High Frequency)
   ```
   GetItem: pk = "session:<session-id>"
   Consistency: Eventually Consistent
   Expected RPS: 1000+
   ```

2. **OTAC Validation** (Low Frequency)
   ```
   GetItem: pk = "otac:<otac-id>"
   Consistency: Strong Consistent (security requirement)
   Expected RPS: 10-50
   ```

3. **Session Update** (Medium Frequency)
   ```
   UpdateItem: pk = "session:<session-id>"
   Update: tokens, updated_at, metadata
   Expected RPS: 100-500
   ```

4. **OTAC Creation** (Low Frequency)
   ```
   PutItem: pk = "otac:<otac-id>"
   Condition: attribute_not_exists(pk)
   Expected RPS: 10-50
   ```

5. **OTAC Consumption** (Low Frequency)
   ```
   UpdateItem: pk = "otac:<otac-id>"
   Condition: attribute_not_exists(usedAt)
   Update: usedAt = current_timestamp
   Expected RPS: 10-50
   ```

#### Performance Considerations

**Read Capacity:**
- Provisioned: 100 RCU (burst to 300)
- On-Demand: Recommended for variable workloads
- Session validation is the primary read pattern

**Write Capacity:**
- Provisioned: 50 WCU (burst to 150)
- On-Demand: Recommended for variable workloads
- Session updates and OTAC operations

**Item Size Optimization:**
- Session records: ~2-4KB (well under 400KB limit)
- OTAC records: ~200-500 bytes
- Raw IdP data stored as compressed Base64

### Data Encryption

**Encryption at Rest:**
- DynamoDB encryption enabled with AWS managed keys
- Sensitive tokens encrypted with application-level encryption before storage

**Encryption in Transit:**
- All DynamoDB API calls use TLS 1.2+
- Application-level encryption for sensitive fields

**Token Encryption Schema:**
```json
{
  "accessToken": "AES256:iv:encrypted_data",
  "refreshToken": "AES256:iv:encrypted_data",
  "idToken": "AES256:iv:encrypted_data"
}
```

### Cleanup and Maintenance

**Automatic Cleanup:**
- TTL handles expired records automatically
- No manual cleanup required for normal operations

**Manual Cleanup Operations:**
- Emergency session invalidation: Delete by session ID
- User logout: Update TTL to immediate expiration
- Security incident: Batch delete by user ID (requires scan)

**Monitoring:**
- CloudWatch metrics for read/write capacity
- Custom metrics for session creation/expiration rates
- Alarms for unusual access patterns

## Frontend Architecture

### React Authentication Context Provider

The new authentication system replaces the existing OIDC-specific context provider with a backend-focused authentication provider that communicates exclusively with the BFF API endpoints.

#### AuthContext Interface

```typescript
interface AuthUser {
  id: string;
  displayName: string;
  email: string;
  groups: string[];
  attributes: Record<string, string>;
}

interface AuthSession {
  expiresAt: string;
  refreshAt: string;
  provider: string;
  refreshed?: boolean;
}

interface AuthState {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  user: AuthUser | null;
  session: AuthSession | null;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  // Actions
  login: (redirectUrl?: string) => void;
  logout: (logoutFromIdp?: boolean) => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
}
```

#### AuthProvider Implementation

```typescript
import axios from 'axios'; // Direct axios for auth endpoints (no Bearer token needed)
import React, { useState, useEffect, useRef, useContext, useMemo } from 'react';

interface AuthProviderProps {
  children: React.ReactNode;
  checkInterval?: number; // Default: 60000ms (1 minute)
  refreshThreshold?: number; // Default: 300000ms (5 minutes before expiry)
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  checkInterval = 60000,
  refreshThreshold = 300000
}) => {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
    session: null,
    error: null
  });

  // Cross-tab synchronization
  const syncManagerRef = useRef<AuthSyncManager | null>(null);

  useEffect(() => {
    syncManagerRef.current = new AuthSyncManager(checkAuthStatus);
    return () => {
      syncManagerRef.current?.destroy();
    };
  }, []);

  // Initial authentication check on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Periodic session validation
  useEffect(() => {
    const interval = setInterval(checkAuthStatus, checkInterval);
    return () => clearInterval(interval);
  }, [checkInterval]);

  const checkAuthStatus = async () => {
    try {
      // Use direct axios for auth endpoints - no Authorization header needed
      const response = await axios.get('/auth/identity', {
        withCredentials: true,
        baseURL: window.location.origin // Auth endpoints are on same domain
      });

      const wasAuthenticated = state.status === 'authenticated';
      
      setState({
        status: 'authenticated',
        user: response.data.user,
        session: response.data.session,
        error: null
      });

      // Broadcast auth state changes to other tabs
      if (!wasAuthenticated || response.data.session.refreshed) {
        syncManagerRef.current?.broadcast({ type: 'AUTH_STATE_CHANGED' });
      }

      // Check if refresh is needed
      if (shouldRefresh(response.data.session)) {
        await refresh();
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        const wasAuthenticated = state.status === 'authenticated';
        
        setState({
          status: 'unauthenticated',
          user: null,
          session: null,
          error: null
        });

        // Broadcast session expiration to other tabs
        if (wasAuthenticated) {
          syncManagerRef.current?.broadcast({ type: 'SESSION_EXPIRED' });
        }
      } else {
        setState(prev => ({
          ...prev,
          status: 'unauthenticated',
          error: 'Failed to check authentication status'
        }));
      }
    }
  };

  const login = (redirectUrl?: string) => {
    const loginUrl = new URL('/auth/login', window.location.origin);
    if (redirectUrl) {
      loginUrl.searchParams.set('redirectUrl', redirectUrl);
    }
    window.location.href = loginUrl.toString();
  };

  const logout = async (logoutFromIdp = false) => {
    try {
      // Use direct axios for auth endpoints - no Authorization header needed
      const response = await axios.post('/auth/logout', 
        { logoutFromIdp },
        { 
          withCredentials: true,
          baseURL: window.location.origin
        }
      );
      
      setState({
        status: 'unauthenticated',
        user: null,
        session: null,
        error: null
      });

      // Notify other tabs
      syncManagerRef.current?.broadcast({ type: 'LOGOUT_INITIATED' });

      // Redirect to IdP logout if provided
      if (response.data.idpLogoutUrl) {
        window.location.href = response.data.idpLogoutUrl;
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to logout'
      }));
    }
  };

  const refresh = async () => {
    await checkAuthStatus();
  };

  const shouldRefresh = (session: AuthSession): boolean => {
    const refreshTime = new Date(session.refreshAt).getTime();
    const now = Date.now();
    return now >= refreshTime - refreshThreshold;
  };

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      logout,
      refresh,
      clearError: () => setState(prev => ({ ...prev, error: null }))
    }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### Component Integration Patterns

#### Protected Route Component

```typescript
interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requiredGroups?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  fallback = <div>Loading...</div>,
  requiredGroups = []
}) => {
  const { status, user, login } = useAuth();

  if (status === 'loading') {
    return <>{fallback}</>;
  }

  if (status === 'unauthenticated') {
    login(window.location.pathname);
    return <>{fallback}</>;
  }

  if (requiredGroups.length > 0 && user) {
    const hasRequiredGroup = requiredGroups.some(group => 
      user.groups.includes(group)
    );
    
    if (!hasRequiredGroup) {
      return <div>Access denied. Required groups: {requiredGroups.join(', ')}</div>;
    }
  }

  return <>{children}</>;
};
```

#### Authentication Hook

```typescript
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Convenience hooks for common patterns
export const useUser = () => {
  const { user } = useAuth();
  return user;
};

export const useAuthStatus = () => {
  const { status } = useAuth();
  return status;
};

export const useRequireAuth = () => {
  const { status, login } = useAuth();
  
  useEffect(() => {
    if (status === 'unauthenticated') {
      login();
    }
  }, [status, login]);
  
  return status === 'authenticated';
};
```

### Cross-Tab Session Synchronization

The authentication provider uses the BroadcastChannel API to synchronize authentication state across multiple browser tabs in real-time.

#### Synchronization Events

```typescript
type AuthBroadcastMessage = 
  | { type: 'AUTH_STATE_CHANGED' }
  | { type: 'SESSION_EXPIRED' }
  | { type: 'LOGOUT_INITIATED' };

class AuthSyncManager {
  private channel: BroadcastChannel;
  
  constructor(private onStateChange: () => void) {
    this.channel = new BroadcastChannel('mlspace-auth');
    this.channel.addEventListener('message', this.handleMessage);
  }

  private handleMessage = (event: MessageEvent<AuthBroadcastMessage>) => {
    switch (event.data.type) {
      case 'AUTH_STATE_CHANGED':
      case 'SESSION_EXPIRED':
        this.onStateChange();
        break;
      case 'LOGOUT_INITIATED':
        // Immediate logout without API call (already done in originating tab)
        this.onStateChange();
        break;
    }
  };

  broadcast(message: AuthBroadcastMessage) {
    this.channel.postMessage(message);
  }

  destroy() {
    this.channel.removeEventListener('message', this.handleMessage);
    this.channel.close();
  }
}

// Usage in AuthProvider:
// - Created in useEffect with checkAuthStatus callback
// - Used to broadcast logout events: syncManagerRef.current?.broadcast({ type: 'LOGOUT_INITIATED' })
// - Automatically triggers checkAuthStatus when other tabs change auth state
```

### Error Handling and User Experience

#### Error Boundary for Authentication

```typescript
interface AuthErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class AuthErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  AuthErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): AuthErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Authentication error:', error, errorInfo);
    
    // Report to monitoring service
    if (window.analytics) {
      window.analytics.track('Auth Error', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="auth-error">
          <h2>Authentication Error</h2>
          <p>Something went wrong with authentication. Please try refreshing the page.</p>
          <button onClick={() => window.location.reload()}>
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

#### Loading States and Transitions

```typescript
interface LoadingStateProps {
  status: AuthContextValue['status'];
  children: React.ReactNode;
}

export const AuthLoadingWrapper: React.FC<LoadingStateProps> = ({
  status,
  children
}) => {
  if (status === 'loading') {
    return (
      <div className="auth-loading">
        <div className="spinner" />
        <p>Checking authentication...</p>
      </div>
    );
  }

  return <>{children}</>;
};
```

#### Session Expiration Handling

```typescript
export const SessionExpirationNotice: React.FC = () => {
  const { status, session, login } = useAuth();
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (status === 'authenticated' && session) {
      const expiryTime = new Date(session.expiresAt).getTime();
      const warningTime = expiryTime - (5 * 60 * 1000); // 5 minutes before expiry
      const now = Date.now();

      if (now >= warningTime) {
        setShowWarning(true);
      } else {
        const timeout = setTimeout(() => setShowWarning(true), warningTime - now);
        return () => clearTimeout(timeout);
      }
    }
  }, [status, session]);

  if (!showWarning || status !== 'authenticated') {
    return null;
  }

  return (
    <div className="session-expiration-notice">
      <p>Your session will expire soon. Click to extend your session.</p>
      <button onClick={() => login()}>
        Extend Session
      </button>
      <button onClick={() => setShowWarning(false)}>
        Dismiss
      </button>
    </div>
  );
};
```

### Migration from Existing OIDC Provider

#### API Call Strategy

**Authentication Endpoints** (`/auth/*`):
- Use direct `axios` import for auth-specific calls
- Cookie-based authentication, no Authorization header
- Set `baseURL: window.location.origin` for same-domain calls

**Regular API Endpoints** (existing MLSpace APIs):
- Use updated `axios-utils` with Authorization header logic removed
- All API calls will use cookie-based authentication
- Backend authorizer validates session cookies only

```typescript
// Auth endpoints - direct axios
import axios from 'axios';
const authResponse = await axios.get('/auth/identity', {
  withCredentials: true,
  baseURL: window.location.origin
});

// Regular API endpoints - use updated axios-utils (no Authorization header)
import axios, { axiosCatch } from '../../shared/util/axios-utils';
const apiResponse = await axios.get('/api/projects').catch(axiosCatch);
```

#### Required axios-utils Updates

The `axios-utils.ts` file will need to be updated to remove OIDC token handling:

```typescript
// Remove this logic from config() function:
const oidcString = sessionStorage.getItem(
    `oidc.user:${window.env.OIDC_URL}:${window.env.OIDC_CLIENT_NAME}`
);
const token = oidcString ? JSON.parse(oidcString).id_token : '';
requestConfig.headers['Authorization'] = `Bearer ${token}`;

// Add withCredentials for cookie support:
requestConfig.withCredentials = true;
```

#### Compatibility Layer

```typescript
// Temporary compatibility layer for existing components
export const LegacyAuthAdapter: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const auth = useAuth();
  
  // Map new auth context to legacy interface
  const legacyContext = useMemo(() => ({
    isAuthenticated: auth.status === 'authenticated',
    user: auth.user,
    login: auth.login,
    logout: () => auth.logout(),
    // Map other legacy properties as needed
  }), [auth]);

  return (
    <LegacyAuthContext.Provider value={legacyContext}>
      {children}
    </LegacyAuthContext.Provider>
  );
};
```

## Security Model

### Cookie Configuration

#### Session Cookie Specification

**Cookie Name:** `mlspace_session`

**Cookie Attributes:**
```http
Set-Cookie: mlspace_session=<session-id>; 
  HttpOnly; 
  Secure; 
  SameSite=Strict; 
  Path=/; 
  Max-Age=86400;
  Domain=<deployment-domain>
```

**Attribute Details:**

| Attribute | Value | Purpose |
|-----------|-------|---------|
| `HttpOnly` | true | Prevents JavaScript access, mitigates XSS attacks |
| `Secure` | true | Only transmitted over HTTPS, prevents MITM attacks |
| `SameSite` | Strict | Prevents CSRF attacks, cookie only sent for same-site requests |
| `Path` | / | Cookie available for all paths on the domain |
| `Max-Age` | 86400 (24h) | Cookie expiration time in seconds |
| `Domain` | Configurable | Set to deployment domain for multi-subdomain support |

#### State Cookie Specification

**Cookie Name:** `mlspace_auth_state`

Used temporarily during authentication flow to prevent CSRF attacks.

**Cookie Attributes:**
```http
Set-Cookie: mlspace_auth_state=<encrypted-state>; 
  HttpOnly; 
  Secure; 
  SameSite=Strict; 
  Path=/auth; 
  Max-Age=600
```

**Key Differences from Session Cookie:**
- Shorter lifetime (10 minutes)
- Limited to `/auth` path
- Deleted after authentication completes

### Session Token Generation and Validation

#### Session ID Generation

```python
import secrets
import uuid

def generate_session_id() -> str:
    """
    Generate cryptographically secure session identifier.
    
    Returns:
        Session ID in format: session:<uuid>
    """
    # Use UUID v4 for uniqueness
    session_uuid = str(uuid.uuid4())
    return f"session:{session_uuid}"

# Example: session:550e8400-e29b-41d4-a716-446655440000
```

**Security Properties:**
- 128-bit entropy from UUID v4
- Cryptographically random
- Unpredictable and non-sequential
- No embedded user information

#### OTAC Generation

```python
def generate_otac() -> str:
    """
    Generate one-time authentication code for cross-domain sync.
    
    Returns:
        OTAC in format: otac:<secure-random-string>
    """
    # 32 bytes = 256 bits of entropy
    random_bytes = secrets.token_urlsafe(32)
    return f"otac:{random_bytes}"

# Example: otac:xK7j9mP2qR5tY8wZ3nB6vC1dF4gH0jL
```

**Security Properties:**
- 256-bit entropy
- URL-safe encoding
- Single-use only
- Short TTL (5 minutes)

#### Session Validation Flow

```python
from typing import Optional
import time

async def validate_session(session_id: str) -> Optional[dict]:
    """
    Validate session cookie and retrieve session data.
    
    Args:
        session_id: Session identifier from cookie
        
    Returns:
        Session data if valid, None otherwise
    """
    # 1. Validate format
    if not session_id.startswith('session:'):
        return None
    
    # 2. Retrieve from DynamoDB
    session_record = await dynamodb.get_item(pk=session_id)
    if not session_record:
        return None
    
    # 3. Check TTL expiration
    if session_record['ttl'] < int(time.time()):
        return None
    
    # 4. Validate session expiration
    session_expires = parse_iso8601(session_record['data']['session']['expiresAt'])
    if session_expires < datetime.now(timezone.utc):
        return None
    
    # 5. Return session data
    return session_record['data']
```

### Token Encryption

Sensitive IdP tokens are encrypted before storage in DynamoDB.

#### Encryption Scheme

```python
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import base64
import os

class TokenEncryption:
    def __init__(self, encryption_key: bytes):
        """
        Initialize token encryption with AES-256-GCM.
        
        Args:
            encryption_key: 32-byte encryption key from AWS Secrets Manager
        """
        self.cipher = AESGCM(encryption_key)
    
    def encrypt_token(self, token: str) -> str:
        """
        Encrypt token using AES-256-GCM.
        
        Returns:
            Encrypted token in format: AES256:<base64-iv>:<base64-ciphertext>
        """
        # Generate random 96-bit nonce
        nonce = os.urandom(12)
        
        # Encrypt with authenticated encryption
        ciphertext = self.cipher.encrypt(nonce, token.encode('utf-8'), None)
        
        # Encode for storage
        iv_b64 = base64.b64encode(nonce).decode('utf-8')
        ct_b64 = base64.b64encode(ciphertext).decode('utf-8')
        
        return f"AES256:{iv_b64}:{ct_b64}"
    
    def decrypt_token(self, encrypted_token: str) -> str:
        """
        Decrypt token using AES-256-GCM.
        
        Args:
            encrypted_token: Encrypted token string
            
        Returns:
            Decrypted token
        """
        # Parse encrypted token
        parts = encrypted_token.split(':')
        if parts[0] != 'AES256' or len(parts) != 3:
            raise ValueError("Invalid encrypted token format")
        
        nonce = base64.b64decode(parts[1])
        ciphertext = base64.b64decode(parts[2])
        
        # Decrypt
        plaintext = self.cipher.decrypt(nonce, ciphertext, None)
        return plaintext.decode('utf-8')
```

**Key Management:**
- Encryption key stored in AWS Secrets Manager
- Key rotation supported via versioning
- Separate keys per environment (dev, staging, prod)

### Cross-Domain Security Considerations

#### Domain Configuration

```typescript
interface DomainConfig {
  primaryDomain: string;      // app.mlspace.com
  syncDomains: string[];       // [api.mlspace.com, notebooks.mlspace.com]
  allowedOrigins: string[];    // For CORS validation
}
```

#### Cookie Domain Strategy

**Option 1: Subdomain Sharing (Recommended)**
```http
Set-Cookie: mlspace_session=<id>; Domain=.mlspace.com
```
- Cookie shared across all subdomains
- Simpler implementation
- No OTAC chain needed for subdomains

**Option 2: Explicit Domain Cookies (More Secure)**
```http
Set-Cookie: mlspace_session=<id>; Domain=app.mlspace.com
Set-Cookie: mlspace_session=<id>; Domain=api.mlspace.com
```
- Cookie isolated per domain
- Requires OTAC chain for synchronization
- Better security isolation

#### OTAC Security

**Validation Requirements:**
1. **Single-use**: OTAC deleted or marked used after first validation
2. **Short TTL**: 5-minute expiration
3. **Strong consistency**: DynamoDB strong consistent reads
4. **Domain validation**: Verify requesting domain is in allowed list

```python
async def validate_otac(otac: str, requesting_domain: str) -> Optional[str]:
    """
    Validate OTAC and return session ID.
    
    Args:
        otac: One-time authentication code
        requesting_domain: Domain making the request
        
    Returns:
        Session ID if valid, None otherwise
    """
    # 1. Strong consistent read
    otac_record = await dynamodb.get_item(
        pk=otac,
        consistent_read=True
    )
    
    if not otac_record:
        return None
    
    # 2. Check if already used
    if otac_record['data'].get('usedAt'):
        return None
    
    # 3. Check TTL
    if otac_record['ttl'] < int(time.time()):
        return None
    
    # 4. Validate domain
    if requesting_domain not in config.syncDomains:
        return None
    
    # 5. Mark as used (conditional update)
    try:
        await dynamodb.update_item(
            pk=otac,
            update_expression="SET #data.usedAt = :timestamp",
            condition_expression="attribute_not_exists(#data.usedAt)",
            expression_attribute_names={"#data": "data"},
            expression_attribute_values={":timestamp": datetime.now().isoformat()}
        )
    except ConditionalCheckFailedException:
        # OTAC was already used (race condition)
        return None
    
    # 6. Return session ID
    return otac_record['data']['sessionId']
```

### CSRF Protection

#### State Parameter Pattern

The authentication flow uses encrypted state parameters to prevent CSRF attacks.

**State Generation:**
```python
from cryptography.fernet import Fernet
import json
import time

class StateManager:
    def __init__(self, secret_key: bytes):
        self.cipher = Fernet(secret_key)
    
    def create_state(self, redirect_url: str, nonce: str) -> str:
        """
        Create encrypted state parameter for auth flow.
        
        Args:
            redirect_url: Where to redirect after auth
            nonce: Random nonce for CSRF protection
            
        Returns:
            Encrypted state string
        """
        state_data = {
            'redirect_url': redirect_url,
            'nonce': nonce,
            'timestamp': int(time.time()),
            'domain': 'app.mlspace.com'
        }
        
        state_json = json.dumps(state_data)
        encrypted = self.cipher.encrypt(state_json.encode('utf-8'))
        return encrypted.decode('utf-8')
    
    def validate_state(self, encrypted_state: str, cookie_nonce: str) -> Optional[dict]:
        """
        Validate and decrypt state parameter.
        
        Args:
            encrypted_state: State from query parameter
            cookie_nonce: Nonce from cookie
            
        Returns:
            State data if valid, None otherwise
        """
        try:
            # Decrypt state
            decrypted = self.cipher.decrypt(encrypted_state.encode('utf-8'))
            state_data = json.loads(decrypted.decode('utf-8'))
            
            # Validate timestamp (10 minute window)
            if int(time.time()) - state_data['timestamp'] > 600:
                return None
            
            # Validate nonce matches cookie
            if state_data['nonce'] != cookie_nonce:
                return None
            
            return state_data
        except Exception:
            return None
```

#### SameSite Cookie Protection

The `SameSite=Strict` attribute provides primary CSRF protection:
- Cookies not sent on cross-site requests
- Prevents CSRF attacks from external sites
- No additional CSRF tokens needed for same-site requests

#### Defense in Depth

Additional CSRF protections:
1. **State parameter validation**: Encrypted state with nonce
2. **Origin header validation**: Check Origin/Referer headers
3. **Short-lived state cookies**: 10-minute expiration

### Security Headers

All authentication endpoints return comprehensive security headers:

```python
SECURITY_HEADERS = {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
}
```

### Audit Logging

All authentication events are logged to CloudWatch for security monitoring:

```python
import json
from datetime import datetime

def log_auth_event(event_type: str, details: dict):
    """
    Log authentication event for audit trail.
    
    Args:
        event_type: Type of auth event
        details: Event details
    """
    log_entry = {
        'timestamp': datetime.now().isoformat(),
        'event_type': event_type,
        'details': details
    }
    
    print(json.dumps(log_entry))

# Event types:
# - AUTH_LOGIN_INITIATED
# - AUTH_LOGIN_SUCCESS
# - AUTH_LOGIN_FAILED
# - AUTH_SESSION_CREATED
# - AUTH_SESSION_REFRESHED
# - AUTH_SESSION_EXPIRED
# - AUTH_LOGOUT
# - AUTH_OTAC_CREATED
# - AUTH_OTAC_VALIDATED
```

## CDK Infrastructure

### Lambda Function Organization

#### Directory Structure

```
backend/src/ml_space_lambda/
├── auth/
│   ├── __init__.py
│   ├── login.py              # POST /auth/login handler
│   ├── callback.py           # GET/POST /auth/callback handler
│   ├── logout.py             # POST /auth/logout handler
│   ├── identity.py           # GET /auth/identity handler
│   ├── sync.py               # GET /auth/sync handler
│   ├── handlers/
│   │   ├── __init__.py
│   │   ├── oidc_handler.py   # OIDC authentication implementation
│   │   └── base_handler.py   # Abstract base class for auth handlers
│   ├── session/
│   │   ├── __init__.py
│   │   ├── manager.py        # Session management logic
│   │   ├── validator.py      # Session validation
│   │   └── encryption.py     # Token encryption utilities
│   └── utils/
│       ├── __init__.py
│       ├── state.py          # State parameter management
│       ├── otac.py           # OTAC generation and validation
│       └── cookies.py        # Cookie utilities
```

#### Lambda Function Registration

Auth endpoints are registered using the existing `registerAPIEndpoint` utility:

```typescript
// In the stack where API endpoints are registered
import { registerAPIEndpoint, MLSpacePythonLambdaFunction } from '../utils/apiFunction';

// Common environment variables for all auth endpoints
const authCommonEnv = {
  SESSION_TABLE_NAME: sessionTable.tableName,
  IDP_TYPE: mlspaceConfig.AUTH_IDP_TYPE,
  PRIMARY_DOMAIN: mlspaceConfig.AUTH_PRIMARY_DOMAIN || '',
  SYNC_DOMAINS: mlspaceConfig.AUTH_SYNC_DOMAINS || '',
  SESSION_TTL_HOURS: mlspaceConfig.AUTH_SESSION_TTL_HOURS.toString(),
  ENCRYPTION_KEY_PARAM: '/mlspace/auth/encryption-key',
};

// OIDC-specific environment variables
const oidcEnv = {
  OIDC_URL: mlspaceConfig.AUTH_OIDC_URL,
  OIDC_CLIENT_ID: mlspaceConfig.AUTH_OIDC_CLIENT_ID,
  OIDC_CLIENT_SECRET_PARAM: '/mlspace/auth/oidc-client-secret',
};

// Define auth endpoint functions
const authEndpoints: MLSpacePythonLambdaFunction[] = [
  {
    name: 'login',
    resource: 'auth',
    description: 'Initiates authentication flow by redirecting to IdP',
    path: 'auth/login',
    method: 'POST',
    noAuthorizer: true,
    environment: { ...authCommonEnv, ...oidcEnv },
  },
  {
    name: 'callback',
    resource: 'auth',
    description: 'Handles IdP callback and creates session',
    path: 'auth/callback',
    method: 'GET',
    noAuthorizer: true,
    environment: { ...authCommonEnv, ...oidcEnv },
  },
  {
    name: 'callback_post',
    id: 'auth-callback-post',
    resource: 'auth',
    description: 'Handles POST callback (for future IdP support)',
    path: 'auth/callback',
    method: 'POST',
    noAuthorizer: true,
    environment: authCommonEnv,
  },
  {
    name: 'logout',
    resource: 'auth',
    description: 'Terminates user session and optionally logs out from IdP',
    path: 'auth/logout',
    method: 'POST',
    noAuthorizer: true,
    environment: {
      SESSION_TABLE_NAME: authCommonEnv.SESSION_TABLE_NAME,
      IDP_TYPE: authCommonEnv.IDP_TYPE,
      OIDC_URL: oidcEnv.OIDC_URL,
    },
  },
  {
    name: 'identity',
    resource: 'auth',
    description: 'Returns current user identity and session status',
    path: 'auth/identity',
    method: 'GET',
    noAuthorizer: true,
    environment: { ...authCommonEnv, ...oidcEnv },
  },
  {
    name: 'sync',
    resource: 'auth',
    description: 'Handles cross-domain cookie synchronization',
    path: 'auth/sync',
    method: 'GET',
    noAuthorizer: true,
    environment: {
      SESSION_TABLE_NAME: authCommonEnv.SESSION_TABLE_NAME,
      PRIMARY_DOMAIN: authCommonEnv.PRIMARY_DOMAIN,
      SYNC_DOMAINS: authCommonEnv.SYNC_DOMAINS,
    },
  },
];

// Register each endpoint
if (mlspaceConfig.BFF_ENABLE_AUTH) {
  authEndpoints.forEach((endpoint) => {
    registerAPIEndpoint(
      stack,
      api,
      authorizer,
      lambdaExecutionRole,
      appRoleName,
      notebookRoleName,
      lambdaSourcePath,
      layers,
      endpoint,
      vpc,
      securityGroups,
      mlspaceConfig,
      permissionsBoundaryArn
    );
  });
}
```

**Lambda Handler Structure:**

Each Lambda handler follows the MLSpace pattern:

```python
# backend/src/ml_space_lambda/auth/lambda_functions.py
def login(event, context):
    """POST /auth/login handler"""
    # Implementation
    pass

def callback(event, context):
    """GET /auth/callback handler"""
    # Implementation
    pass

def callback_post(event, context):
    """POST /auth/callback handler (for future IdP support)"""
    # Implementation
    pass

def logout(event, context):
    """POST /auth/logout handler"""
    # Implementation
    pass

def identity(event, context):
    """GET /auth/identity handler"""
    # Implementation
    pass

def sync(event, context):
    """GET /auth/sync handler"""
    # Implementation
    pass
```



### DynamoDB Table Definition

Following MLSpace's existing table creation pattern:

```typescript
// In the existing stack where other DynamoDB tables are created
if (mlspaceConfig.BFF_ENABLE_AUTH) {
  const sessionTable = new Table(scope, 'mlspace-ddb-auth-sessions', {
    tableName: mlspaceConfig.AUTH_SESSION_TABLE_NAME,
    partitionKey: {
      name: 'pk',
      type: AttributeType.STRING,
    },
    billingMode: BillingMode.PAY_PER_REQUEST,
    ...(mlspaceConfig.EXISTING_KMS_MASTER_KEY_ARN && mlspaceConfig.ENABLE_DDB_KMS_CMK_ENCRYPTION) 
      ? {encryptionKey: props.encryptionKey} 
      : {encryption: TableEncryption.AWS_MANAGED},
    timeToLiveAttribute: 'ttl',
  });
}
```

**Key Features:**
- Follows MLSpace's conditional encryption pattern
- Uses customer-managed KMS key if configured, otherwise AWS-managed encryption
- Pay-per-request billing for variable auth workloads
- TTL attribute for automatic session cleanup
- Table name from constants (AUTH_SESSION_TABLE_NAME)

### Authorizer Updates

The existing Lambda authorizer needs to be updated to validate session cookies.

```typescript
// lib/constructs/auth/authorizerConstruct.ts
import { Duration } from 'aws-cdk-lib';
import { AuthorizationType, RequestAuthorizer } from 'aws-cdk-lib/aws-apigateway';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { ISecurityGroup, IVpc } from 'aws-cdk-lib/aws-ec2';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface AuthorizerConstructProps {
  readonly lambdaSourcePath: string;
  readonly sessionTable: Table;
  readonly vpc: IVpc;
  readonly securityGroups: ISecurityGroup[];
}

export class AuthorizerConstruct extends Construct {
  public readonly authorizer: RequestAuthorizer;

  constructor(scope: Construct, id: string, props: AuthorizerConstructProps) {
    super(scope, id);

    // Updated authorizer Lambda
    const authorizerFunction = new Function(this, 'AuthorizerFunction', {
      runtime: Runtime.PYTHON_3_11,
      code: Code.fromAsset(props.lambdaSourcePath),
      handler: 'ml_space_lambda.authorizer.lambda_functions.handler',
      timeout: Duration.seconds(10),
      memorySize: 256,
      vpc: props.vpc,
      securityGroups: props.securityGroups,
      environment: {
        SESSION_TABLE_NAME: props.sessionTable.tableName,
      },
    });

    // Grant DynamoDB read permissions
    props.sessionTable.grantReadData(authorizerFunction);

    // Create request authorizer
    this.authorizer = new RequestAuthorizer(this, 'RequestAuthorizer', {
      handler: authorizerFunction,
      identitySources: ['method.request.header.Cookie'],
      resultsCacheTtl: Duration.seconds(300), // Cache for 5 minutes
    });
  }
}
```

### Secrets Management

```typescript
// lib/constructs/auth/secretsConstruct.ts
import { RemovalPolicy } from 'aws-cdk-lib';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface AuthSecretsConstructProps {
  readonly encryptionKey: IKey;
}

export class AuthSecretsConstruct extends Construct {
  public readonly authSecrets: Secret;

  constructor(scope: Construct, id: string, props: AuthSecretsConstructProps) {
    super(scope, id);

    // Create secret for auth configuration
    this.authSecrets = new Secret(this, 'AuthSecrets', {
      secretName: 'mlspace/auth/config',
      description: 'Authentication configuration including IdP credentials and encryption keys',
      encryptionKey: props.encryptionKey,
      removalPolicy: RemovalPolicy.RETAIN,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          idpType: 'oidc',
          oidcClientId: 'REPLACE_ME',
          oidcClientSecret: 'REPLACE_ME',
          oidcIssuerUrl: 'REPLACE_ME',
          encryptionKey: 'REPLACE_ME', // 32-byte base64 encoded key
          stateEncryptionKey: 'REPLACE_ME', // Fernet key
        }),
        generateStringKey: 'placeholder',
      },
    });
  }
}
```

### IAM Roles and Permissions

```typescript
// lib/constructs/auth/iamConstruct.ts
import { Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class AuthIamConstruct extends Construct {
  public readonly lambdaExecutionRole: Role;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Lambda execution role
    this.lambdaExecutionRole = new Role(this, 'AuthLambdaExecutionRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      description: 'Execution role for authentication Lambda functions',
    });

    // CloudWatch Logs permissions
    this.lambdaExecutionRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: ['arn:aws:logs:*:*:*'],
      })
    );

    // VPC permissions (if using VPC)
    this.lambdaExecutionRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'ec2:CreateNetworkInterface',
          'ec2:DescribeNetworkInterfaces',
          'ec2:DeleteNetworkInterface',
        ],
        resources: ['*'],
      })
    );
  }
}
```

### Environment Configuration

Configuration follows MLSpace's existing pattern using `lib/config.json` and `lib/constants.ts`.

#### Constants Updates (lib/constants.ts)

```typescript
// Authentication configuration
export const AUTH_SESSION_TABLE_NAME = 'mlspace-auth-sessions';

// Authentication configuration (replaces legacy OIDC_* settings)
export const AUTH_IDP_TYPE = 'oidc'; // Currently only 'oidc' is supported
export const AUTH_OIDC_URL = ''; // OIDC issuer URL (replaces OIDC_URL)
export const AUTH_OIDC_CLIENT_ID = ''; // OIDC client ID (replaces OIDC_CLIENT_NAME)
export const AUTH_OIDC_CLIENT_SECRET = ''; // OIDC client secret (if using confidential client flow)

// Domain configuration for cross-domain cookie sync
export const AUTH_PRIMARY_DOMAIN = ''; // Optional: Override API Gateway domain for cookies
export const AUTH_SYNC_DOMAINS = ''; // Optional: Comma-separated list of additional domains for cookie sync

// Session configuration
export const AUTH_SESSION_TTL_HOURS = 24; // Session duration in hours
```

#### Config File Updates (lib/config.json)

```json
{
  "AWS_ACCOUNT": "427935540279",
  "AWS_REGION": "us-east-1",
  "KEY_MANAGER_ROLE_NAME": "Admin",
  "AUTH_IDP_TYPE": "oidc",
  "AUTH_OIDC_URL": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_gGfd5y9Fd",
  "AUTH_OIDC_CLIENT_ID": "2voakvh33rj8st1qr004sisvtt",
  "AUTH_OIDC_CLIENT_SECRET": "",
  "AUTH_PRIMARY_DOMAIN": "",
  "AUTH_SYNC_DOMAINS": "",
  "AUTH_SESSION_TTL_HOURS": 24
}
```

#### Configuration Loading

```typescript
// lib/utils/configTypes.ts (additions)
export interface MLSpaceConfig {
  // ... existing properties ...
  
  // Authentication (BFF pattern - replaces legacy OIDC)
  AUTH_IDP_TYPE: string; // 'oidc', 'saml', or 'custom'
  AUTH_OIDC_URL: string;
  AUTH_OIDC_CLIENT_ID: string;
  AUTH_OIDC_CLIENT_SECRET: string;
  AUTH_PRIMARY_DOMAIN: string;
  AUTH_SYNC_DOMAINS: string;
  AUTH_SESSION_TTL_HOURS: number;
}
```

#### Lambda Environment Variables

```typescript
// Lambda functions receive these environment variables from config
const authEnvironment = {
  SESSION_TABLE_NAME: AUTH_SESSION_TABLE_NAME,
  IDP_TYPE: config.BFF_IDP_TYPE || 'oidc', // 'oidc', 'saml', or 'custom'
  OIDC_URL: config.OIDC_URL,
  OIDC_CLIENT_NAME: config.OIDC_CLIENT_NAME,
  OIDC_CLIENT_SECRET_PARAM: '/mlspace/auth/oidc-client-secret', // SSM Parameter
  PRIMARY_DOMAIN: config.BFF_PRIMARY_DOMAIN || '', // Defaults to API Gateway domain
  SYNC_DOMAINS: config.BFF_SYNC_DOMAINS || '', // Comma-separated
  SESSION_TTL_HOURS: config.BFF_SESSION_TTL_HOURS.toString(),
  ENCRYPTION_KEY_PARAM: '/mlspace/auth/encryption-key', // SSM Parameter
};
```

### Complete Stack Integration

```typescript
// In the existing MLSpace stack where API endpoints are registered
import { registerAPIEndpoint } from '../utils/apiFunction';

// Create session table
const sessionTable = new Table(this, 'mlspace-ddb-auth-sessions', {
  tableName: mlspaceConfig.AUTH_SESSION_TABLE_NAME,
  partitionKey: {
    name: 'pk',
    type: AttributeType.STRING,
  },
  billingMode: BillingMode.PAY_PER_REQUEST,
  ...(mlspaceConfig.EXISTING_KMS_MASTER_KEY_ARN && mlspaceConfig.ENABLE_DDB_KMS_CMK_ENCRYPTION) 
    ? {encryptionKey: props.encryptionKey} 
    : {encryption: TableEncryption.AWS_MANAGED},
  timeToLiveAttribute: 'ttl',
});

// Grant Lambda execution role permissions to session table
sessionTable.grantReadWriteData(lambdaExecutionRole);

// Register auth endpoints using existing pattern
const authEndpoints: MLSpacePythonLambdaFunction[] = [
  // ... endpoint definitions from Lambda Function Registration section ...
];

authEndpoints.forEach((endpoint) => {
  registerAPIEndpoint(
    this,
    api,
    authorizer,
    lambdaExecutionRole,
    appRoleName,
    notebookRoleName,
    lambdaSourcePath,
    layers,
    endpoint,
    vpc,
    securityGroups,
    mlspaceConfig,
    permissionsBoundaryArn
  );
});

// Existing API endpoint registrations continue as normal...
```

**Authorizer Updates:**

The existing authorizer Lambda (`backend/src/ml_space_lambda/authorizer/lambda_functions.py`) needs to be updated to:
1. Extract session cookie from request headers
2. Validate session from DynamoDB
3. Populate authContext with user information from session
4. Return 401 if session is invalid or expired

### Deployment Configuration

Configuration is managed through `lib/config.json` per environment:

```json
// lib/config.json (example for GeoAxis integration)
{
  "AWS_ACCOUNT": "123456789012",
  "AWS_REGION": "us-east-1",
  "OIDC_URL": "https://geoaxis.gxaccess.com",
  "KEY_MANAGER_ROLE_NAME": "Admin",
  "AUTH_IDP_TYPE": "oidc",
  "AUTH_OIDC_URL": "https://geoaxis.gxaccess.com",
  "AUTH_OIDC_CLIENT_ID": "mlspace-client-id",
  "AUTH_OIDC_CLIENT_SECRET": "stored-in-ssm",
  "AUTH_PRIMARY_DOMAIN": "",
  "AUTH_SYNC_DOMAINS": "",
  "AUTH_SESSION_TTL_HOURS": 24
}
```

**Configuration Notes:**
- `AUTH_IDP_TYPE`: Defaults to `'oidc'` (currently only OIDC is supported)
- `AUTH_OIDC_URL`: OIDC issuer URL (replaces legacy `OIDC_URL`)
- `AUTH_OIDC_CLIENT_ID`: OIDC client ID (replaces legacy `OIDC_CLIENT_NAME`)
- `AUTH_OIDC_CLIENT_SECRET`: Actual secret stored in SSM Parameter Store at `/mlspace/auth/oidc-client-secret`
- `AUTH_PRIMARY_DOMAIN`: Leave empty to use API Gateway domain automatically
- `AUTH_SYNC_DOMAINS`: Leave empty for single-domain deployments (typical for MLSpace)

### Migration from Legacy OIDC Configuration

**Configuration Key Mapping:**

| Legacy Key | New Key | Notes |
|------------|---------|-------|
| `OIDC_URL` | `AUTH_OIDC_URL` | OIDC issuer URL |
| `OIDC_CLIENT_NAME` | `AUTH_OIDC_CLIENT_ID` | OIDC client identifier |
| N/A | `AUTH_OIDC_CLIENT_SECRET` | New: for confidential client flows |
| N/A | `AUTH_IDP_TYPE` | New: defaults to 'oidc' |
| N/A | `AUTH_PRIMARY_DOMAIN` | New: optional domain override |
| N/A | `AUTH_SYNC_DOMAINS` | New: for multi-domain deployments |
| N/A | `AUTH_SESSION_TTL_HOURS` | New: session duration (default 24h) |

**Migration Steps:**

1. **Update lib/config.json:**
   ```json
   // Before
   {
     "OIDC_URL": "https://idp.example.com",
     "OIDC_CLIENT_NAME": "my-client-id"
   }
   
   // After
   {
     "AUTH_IDP_TYPE": "oidc",
     "AUTH_OIDC_URL": "https://idp.example.com",
     "AUTH_OIDC_CLIENT_ID": "my-client-id",
     "AUTH_OIDC_CLIENT_SECRET": "",
     "AUTH_SESSION_TTL_HOURS": 24
   }
   ```

2. **Update lib/constants.ts:**
   - Remove: `OIDC_URL`, `OIDC_CLIENT_NAME`, `INTERNAL_OIDC_URL`, `OIDC_VERIFY_SSL`, `OIDC_VERIFY_SIGNATURE`, `OIDC_REDIRECT_URI`
   - Add: `AUTH_IDP_TYPE`, `AUTH_OIDC_URL`, `AUTH_OIDC_CLIENT_ID`, `AUTH_OIDC_CLIENT_SECRET`, `AUTH_SESSION_TTL_HOURS`, `AUTH_PRIMARY_DOMAIN`, `AUTH_SYNC_DOMAINS`

3. **Store OIDC client secret in SSM Parameter Store** (if using confidential client flow):
   ```bash
   aws ssm put-parameter \
     --name /mlspace/auth/oidc-client-secret \
     --value "your-client-secret" \
     --type SecureString \
     --description "OIDC client secret for BFF authentication"
   ```

4. **Update frontend:**
   - Remove OIDC context provider
   - Add new BFF authentication context provider
   - Update axios-utils to remove Authorization header logic

5. **Deploy infrastructure:**
   - CDK will create session table
   - Auth endpoints will be registered
   - Authorizer will be updated to validate session cookies

## Remaining Design Areas

The following areas still need detailed design specifications:

### 6. Error Handling Flows
- [ ] Comprehensive error scenarios and recovery
- [ ] Logging and monitoring strategies
- [ ] User-facing error messages and redirects
- [ ] Debugging and troubleshooting guides

### 7. Configuration Management
- [ ] IdP type selection and configuration schema
- [ ] Environment variable management
- [ ] Deployment-specific settings
- [ ] Runtime configuration updates

### 3. Frontend Architecture
- [ ] React authentication context provider design
- [ ] Component integration patterns
- [ ] Cross-tab session synchronization
- [ ] Error handling and user experience flows

### 4. Security Model
- [ ] Cookie configuration and security flags
- [ ] Session token generation and validation
- [ ] Cross-domain security considerations
- [ ] CSRF protection mechanisms

### 5. CDK Infrastructure
- [ ] Lambda function organization and deployment
- [ ] API Gateway routing and configuration
- [ ] IAM roles and permissions
- [ ] Environment-specific configuration management

### 6. Error Handling Flows
- [ ] Comprehensive error scenarios and recovery
- [ ] Logging and monitoring strategies
- [ ] User-facing error messages and redirects
- [ ] Debugging and troubleshooting guides

### 7. Configuration Management
- [ ] IdP type selection and configuration schema
- [ ] Environment variable management
- [ ] Deployment-specific settings
- [ ] Runtime configuration updates