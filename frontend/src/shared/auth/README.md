# Authentication Hooks and Utilities

This directory contains authentication hooks, components, and utilities for the MLSpace BFF (Backend for Frontend) authentication system.

## Overview

The BFF authentication pattern abstracts authentication complexity from the frontend and centralizes all Identity Provider integration in the backend. This provides better security, simplified frontend code, and improved session management.

## Files

- `hooks.ts` - Authentication hooks for accessing auth state and user information
- `components.tsx` - React components for authentication UI and route protection
- `index.ts` - Main export file for all authentication utilities
- `auth.css` - CSS styles for authentication components
- `private-route.tsx` - Legacy private route component (deprecated)

## Hooks

### Core Hooks

#### `useAuth()`
Main hook to access the authentication context.

```typescript
const { status, user, session, login, logout, refresh, clearError } = useAuth();
```

#### `useUser()`
Convenience hook to get the current authenticated user.

```typescript
const user = useUser(); // AuthUser | null
```

#### `useAuthStatus()`
Convenience hook to get the current authentication status.

```typescript
const status = useAuthStatus(); // 'loading' | 'authenticated' | 'unauthenticated'
```

#### `useRequireAuth()`
Hook that automatically redirects to login if user is not authenticated.

```typescript
const isAuthenticated = useRequireAuth(); // boolean
```

### Authorization Hooks

#### `useHasGroups(requiredGroups: string[])`
Check if user has any of the required groups.

```typescript
const hasAccess = useHasGroups(['admin', 'moderator']);
```

#### `useHasGroup(group: string)`
Check if user has a specific group.

```typescript
const isAdmin = useHasGroup('admin');
```

### User Data Hooks

#### `useUserAttributes()`
Get all user attributes.

```typescript
const attributes = useUserAttributes(); // Record<string, string>
```

#### `useUserAttribute(attributeName: string)`
Get a specific user attribute.

```typescript
const department = useUserAttribute('department');
```

## Components

### Route Protection

#### `ProtectedRoute`
Component that protects routes by requiring authentication and optionally specific groups.

```typescript
<ProtectedRoute 
    requiredGroups={['admin']}
    fallback={<div>Loading...</div>}
    accessDeniedMessage="Admin access required"
>
    <AdminPanel />
</ProtectedRoute>
```

Props:
- `children` - Content to render when access is granted
- `fallback?` - Component to show while loading (default: "Loading...")
- `requiredGroups?` - Array of groups that grant access
- `accessDeniedMessage?` - Custom access denied message

#### `ConditionalRender`
Component that conditionally renders content based on authentication and group membership.

```typescript
<ConditionalRender 
    requiredGroups={['admin']} 
    fallback={<div>Access denied</div>}
>
    <AdminButton />
</ConditionalRender>
```

### Loading States

#### `AuthLoadingWrapper`
Component that shows loading state while authentication is being checked.

```typescript
<AuthLoadingWrapper 
    loadingComponent={<CustomSpinner />}
    showSpinner={true}
>
    <App />
</AuthLoadingWrapper>
```

### Session Management

#### `SessionExpirationNotice`
Component that shows a warning when the session is about to expire.

```typescript
<SessionExpirationNotice 
    warningMinutes={5}
    customMessage="Your session will expire soon!"
    onExtend={() => console.log('Extending session')}
    onDismiss={() => console.log('Dismissed warning')}
/>
```

### Error Handling

#### `AuthErrorBoundary`
Error boundary component specifically for authentication errors.

```typescript
<AuthErrorBoundary 
    fallback={CustomErrorComponent}
    onError={(error, errorInfo) => console.error(error)}
>
    <App />
</AuthErrorBoundary>
```

### User Information

#### `UserInfo`
Component that displays current user information.

```typescript
<UserInfo 
    showEmail={true}
    showGroups={true}
    showAttributes={false}
    className="custom-user-info"
/>
```

## Usage Examples

### Basic Authentication Setup

```typescript
import React from 'react';
import { AuthProvider, AuthErrorBoundary, AuthLoadingWrapper } from '../shared/auth';

function App() {
    return (
        <AuthErrorBoundary>
            <AuthProvider checkInterval={60000} refreshThreshold={300000}>
                <AuthLoadingWrapper>
                    <MainApp />
                </AuthLoadingWrapper>
            </AuthProvider>
        </AuthErrorBoundary>
    );
}
```

### Protected Routes

```typescript
import { ProtectedRoute, useAuth } from '../shared/auth';

function AdminPage() {
    return (
        <ProtectedRoute requiredGroups={['admin']}>
            <h1>Admin Dashboard</h1>
            <AdminControls />
        </ProtectedRoute>
    );
}
```

### Conditional UI Elements

```typescript
import { ConditionalRender, useUser } from '../shared/auth';

function Navigation() {
    const user = useUser();
    
    return (
        <nav>
            <Link to="/">Home</Link>
            <ConditionalRender requiredGroups={['admin']}>
                <Link to="/admin">Admin</Link>
            </ConditionalRender>
            {user && <span>Welcome, {user.displayName}</span>}
        </nav>
    );
}
```

### Session Management

```typescript
import { SessionExpirationNotice, useAuth } from '../shared/auth';

function Layout() {
    const { status } = useAuth();
    
    return (
        <div>
            <Header />
            <main>
                <Routes />
            </main>
            {status === 'authenticated' && <SessionExpirationNotice />}
        </div>
    );
}
```

## CSS Classes

The authentication components use the following CSS classes (defined in `auth.css`):

- `.auth-loading` - Loading state container
- `.auth-access-denied` - Access denied message
- `.session-expiration-notice` - Session expiration warning
- `.auth-error` - Authentication error display
- `.user-info` - User information display

## Migration from Legacy OIDC

When migrating from the legacy OIDC system:

1. Replace `PrivateRoute` with `ProtectedRoute`
2. Update imports to use the new authentication hooks
3. Remove direct OIDC token handling
4. Use the new session-based authentication

### Before (Legacy)
```typescript
import { PrivateRoute } from '../shared/auth/private-route';

<PrivateRoute hasAnyAuthorities={['admin']}>
    <AdminPanel />
</PrivateRoute>
```

### After (BFF)
```typescript
import { ProtectedRoute } from '../shared/auth';

<ProtectedRoute requiredGroups={['admin']}>
    <AdminPanel />
</ProtectedRoute>
```

## Type Definitions

All TypeScript types are exported from the main index file:

```typescript
import type { 
    AuthUser, 
    AuthSession, 
    AuthState, 
    AuthContextValue,
    ProtectedRouteProps,
    AuthLoadingWrapperProps
} from '../shared/auth';
```

## Error Handling

The authentication system provides comprehensive error handling:

1. **Network Errors** - Handled gracefully with retry logic
2. **Session Expiration** - Automatic detection and user notification
3. **Authorization Errors** - Clear access denied messages
4. **Component Errors** - Error boundaries prevent app crashes

## Security Considerations

- All authentication state is managed server-side
- Session cookies are HTTP-only and secure
- Cross-tab synchronization prevents state inconsistencies
- Automatic token refresh prevents session interruption
- Error boundaries prevent sensitive information leakage