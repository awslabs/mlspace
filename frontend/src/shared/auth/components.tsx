/**
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License").
You may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks';

/**
 * Props for ProtectedRoute component
 */
export type ProtectedRouteProps = {
    children: React.ReactNode;
    fallback?: React.ReactNode;
    requiredGroups?: string[];
    accessDeniedMessage?: string;
};

/**
 * Component that protects routes by requiring authentication and optionally specific groups
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    fallback = <div>Loading...</div>,
    requiredGroups = [],
    accessDeniedMessage
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
        const hasRequiredGroup = requiredGroups.some((group) =>
            user.groups.includes(group)
        );
        
        if (!hasRequiredGroup) {
            const defaultMessage = `Access denied. Required groups: ${requiredGroups.join(', ')}`;
            return (
                <div className='auth-access-denied'>
                    <h3>Access Denied</h3>
                    <p>{accessDeniedMessage || defaultMessage}</p>
                </div>
            );
        }
    }
    
    return <>{children}</>;
};

/**
 * Props for AuthLoadingWrapper component
 */
export type AuthLoadingWrapperProps = {
    children: React.ReactNode;
    loadingComponent?: React.ReactNode;
    showSpinner?: boolean;
};

/**
 * Component that shows loading state while authentication is being checked
 */
export const AuthLoadingWrapper: React.FC<AuthLoadingWrapperProps> = ({
    children,
    loadingComponent,
    showSpinner = true
}) => {
    const { status } = useAuth();
    
    if (status === 'loading') {
        if (loadingComponent) {
            return <>{loadingComponent}</>;
        }
        
        return (
            <div className='auth-loading'>
                {showSpinner && <div className='spinner' />}
                <p>Checking authentication...</p>
            </div>
        );
    }
    
    return <>{children}</>;
};

/**
 * Props for SessionExpirationNotice component
 */
export type SessionExpirationNoticeProps = {
    warningMinutes?: number;
    onExtend?: () => void;
    onDismiss?: () => void;
    customMessage?: string;
};

/**
 * Component that shows a warning when the session is about to expire
 */
export const SessionExpirationNotice: React.FC<SessionExpirationNoticeProps> = ({
    warningMinutes = 5,
    onExtend,
    onDismiss,
    customMessage
}) => {
    const { status, session, login } = useAuth();
    const [showWarning, setShowWarning] = useState(false);
    
    useEffect(() => {
        if (status === 'authenticated' && session) {
            const expiryTime = new Date(session.expiresAt).getTime();
            const warningTime = expiryTime - (warningMinutes * 60 * 1000);
            const now = Date.now();
            
            if (now >= warningTime) {
                setShowWarning(true);
            } else {
                const timeout = setTimeout(() => setShowWarning(true), warningTime - now);
                return () => clearTimeout(timeout);
            }
        }
    }, [status, session, warningMinutes]);
    
    const handleExtend = () => {
        if (onExtend) {
            onExtend();
        } else {
            login();
        }
    };
    
    const handleDismiss = () => {
        if (onDismiss) {
            onDismiss();
        } else {
            setShowWarning(false);
        }
    };
    
    if (!showWarning || status !== 'authenticated') {
        return null;
    }
    
    const defaultMessage = `Your session will expire in ${warningMinutes} minutes. Click to extend your session.`;
    
    return (
        <div className='session-expiration-notice'>
            <div className='session-expiration-content'>
                <p>{customMessage || defaultMessage}</p>
                <div className='session-expiration-actions'>
                    <button 
                        className='session-extend-button'
                        onClick={handleExtend}
                    >
                        Extend Session
                    </button>
                    <button 
                        className='session-dismiss-button'
                        onClick={handleDismiss}
                    >
                        Dismiss
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * Props for AuthErrorBoundary component
 */
export type AuthErrorBoundaryProps = {
    children: React.ReactNode;
    fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
};

/**
 * State for AuthErrorBoundary component
 */
type AuthErrorBoundaryState = {
    hasError: boolean;
    error: Error | null;
};

/**
 * Error boundary component specifically for authentication errors
 */
export class AuthErrorBoundary extends React.Component<
    AuthErrorBoundaryProps,
    AuthErrorBoundaryState
> {
    constructor (props: AuthErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    
    static getDerivedStateFromError (error: Error): AuthErrorBoundaryState {
        return { hasError: true, error };
    }
    
    componentDidCatch (error: Error, errorInfo: React.ErrorInfo) {
        console.error('Authentication error:', error, errorInfo);
        
        // Call custom error handler if provided
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
        
        // Report to monitoring service if available
        if ((window as any).analytics) {
            (window as any).analytics.track('Auth Error', {
                error: error.message,
                stack: error.stack,
                componentStack: errorInfo.componentStack
            });
        }
    }
    
    resetError = () => {
        this.setState({ hasError: false, error: null });
    };
    
    render () {
        if (this.state.hasError && this.state.error) {
            // Use custom fallback component if provided
            if (this.props.fallback) {
                const FallbackComponent = this.props.fallback;
                return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
            }
            
            // Default error UI
            return (
                <div className='auth-error'>
                    <h2>Authentication Error</h2>
                    <p>Something went wrong with authentication. Please try refreshing the page.</p>
                    <div className='auth-error-actions'>
                        <button onClick={() => window.location.reload()}>
                            Refresh Page
                        </button>
                        <button onClick={this.resetError}>
                            Try Again
                        </button>
                    </div>
                    {process.env.NODE_ENV === 'development' && (
                        <details className='auth-error-details'>
                            <summary>Error Details</summary>
                            <pre>{this.state.error.stack}</pre>
                        </details>
                    )}
                </div>
            );
        }
        
        return this.props.children;
    }
}

/**
 * Props for ConditionalRender component
 */
export type ConditionalRenderProps = {
    children: React.ReactNode;
    requiredGroups?: string[];
    fallback?: React.ReactNode;
    requireAuth?: boolean;
};

/**
 * Component that conditionally renders content based on authentication and group membership
 */
export const ConditionalRender: React.FC<ConditionalRenderProps> = ({
    children,
    requiredGroups = [],
    fallback = null,
    requireAuth = true
}) => {
    const { status, user } = useAuth();
    
    // If authentication is required but user is not authenticated
    if (requireAuth && status !== 'authenticated') {
        return <>{fallback}</>;
    }
    
    // If specific groups are required
    if (requiredGroups.length > 0 && user) {
        const hasRequiredGroup = requiredGroups.some((group) =>
            user.groups.includes(group)
        );
        
        if (!hasRequiredGroup) {
            return <>{fallback}</>;
        }
    }
    
    return <>{children}</>;
};

/**
 * Props for UserInfo component
 */
export type UserInfoProps = {
    showEmail?: boolean;
    showGroups?: boolean;
    showAttributes?: boolean;
    className?: string;
};

/**
 * Component that displays current user information
 */
export const UserInfo: React.FC<UserInfoProps> = ({
    showEmail = true,
    showGroups = false,
    showAttributes = false,
    className = 'user-info'
}) => {
    const { user } = useAuth();
    
    if (!user) {
        return null;
    }
    
    return (
        <div className={className}>
            <div className='user-display-name'>{user.displayName}</div>
            {showEmail && user.email && (
                <div className='user-email'>{user.email}</div>
            )}
            {showGroups && user.groups.length > 0 && (
                <div className='user-groups'>
                    <span>Groups: </span>
                    {user.groups.join(', ')}
                </div>
            )}
            {showAttributes && Object.keys(user.attributes).length > 0 && (
                <div className='user-attributes'>
                    {Object.entries(user.attributes).map(([key, value]) => (
                        <div key={key} className='user-attribute'>
                            <span className='attribute-key'>{key}:</span>
                            <span className='attribute-value'>{value}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};