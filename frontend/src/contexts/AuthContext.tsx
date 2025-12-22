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

import axios, { axiosCatch } from '../shared/util/axios-utils';
import React, { useState, useEffect, useRef, useContext, useMemo, createContext } from 'react';

// Types and Interfaces
export type AuthUser = {
    id: string;
    displayName: string;
    email: string;
    groups: string[];
    attributes: Record<string, string>;
};

export type AuthSession = {
    expiresAt: string;
    refreshAt: string;
    provider: string;
    refreshed?: boolean;
};

export type AuthState = {
    status: 'loading' | 'authenticated' | 'unauthenticated';
    user: AuthUser | null;
    session: AuthSession | null;
    error: string | null;
};

export type AuthContextValue = AuthState & {
    // Actions
    login: (redirectUrl?: string) => void;
    logout: (logoutFromIdp?: boolean) => Promise<void>;
    refresh: () => Promise<void>;
    clearError: () => void;
};

// Cross-tab synchronization message types
type AuthBroadcastMessage =
| { type: 'AUTH_STATE_CHANGED' }
| { type: 'SESSION_EXPIRED' }
| { type: 'LOGOUT_INITIATED' };

// Cross-tab synchronization manager
class AuthSyncManager {
    private channel: BroadcastChannel;
    
    constructor (private onStateChange: () => void) {
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
    
    broadcast (message: AuthBroadcastMessage) {
        this.channel.postMessage(message);
    }
    
    destroy () {
        this.channel.removeEventListener('message', this.handleMessage);
        this.channel.close();
    }
}

// Create the context
const AuthContext = createContext<AuthContextValue | null>(null);

// AuthProvider props
type AuthProviderProps = {
    children: React.ReactNode;
    checkInterval?: number; // Default: 60000ms (1 minute)
    refreshThreshold?: number; // Default: 300000ms (5 minutes before expiry)
};

// AuthProvider component
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
    
    const shouldRefresh = (session: AuthSession): boolean => {
        const refreshTime = new Date(session.refreshAt).getTime();
        const now = Date.now();
        return now >= refreshTime - refreshThreshold;
    };
    
    const refresh = async () => {
        await checkAuthStatus();
    };
    
    const checkAuthStatus = async () => {
        try {
            // Use axios-utils for standardized baseURL configuration
            const response = await axios.get('/auth/identity').catch(axiosCatch);
            
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
        } catch (error: any) {
            if (error?.code === 401) {
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
                setState((prev) => ({
                    ...prev,
                    status: 'unauthenticated',
                    error: 'Failed to check authentication status'
                }));
            }
        }
    };
    
    useEffect(() => {
        syncManagerRef.current = new AuthSyncManager(checkAuthStatus);
        return () => {
            syncManagerRef.current?.destroy();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    
    // Initial authentication check on mount
    useEffect(() => {
        checkAuthStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    
    // Periodic session validation
    useEffect(() => {
        const interval = setInterval(checkAuthStatus, checkInterval);
        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [checkInterval]);
    

    
    const login = (redirectUrl?: string) => {
        // For login redirect, we need to construct the full URL since it's a page redirect
        const baseUrl = (window as any).env?.LAMBDA_ENDPOINT || window.location.origin;
        const loginUrl = new URL('/auth/login', baseUrl);
        if (redirectUrl) {
            loginUrl.searchParams.set('redirectUrl', redirectUrl);
        }
        window.location.href = loginUrl.toString();
    };
    
    const logout = async (logoutFromIdp = false) => {
        try {
            // Use axios-utils for standardized baseURL configuration
            const response = await axios.post('/auth/logout', { logoutFromIdp }).catch(axiosCatch);
            
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
            setState((prev) => ({
                ...prev,
                error: 'Failed to logout'
            }));
        }
    };
    
    const clearError = () => setState((prev) => ({ ...prev, error: null }));
    
    const contextValue = useMemo(() => ({
        ...state,
        login,
        logout,
        refresh,
        clearError
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [state]);
    
    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hooks for consuming the context
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

// Protected Route component
type ProtectedRouteProps = {
    children: React.ReactNode;
    fallback?: React.ReactNode;
    requiredGroups?: string[];
};

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
        const hasRequiredGroup = requiredGroups.some((group) =>
            user.groups.includes(group)
        );
        
        if (!hasRequiredGroup) {
            return <div>Access denied. Required groups: {requiredGroups.join(', ')}</div>;
        }
    }
    
    return <>{children}</>;
};

// Loading wrapper component
type LoadingStateProps = {
    status: AuthContextValue['status'];
    children: React.ReactNode;
};

export const AuthLoadingWrapper: React.FC<LoadingStateProps> = ({
    status,
    children
}) => {
    if (status === 'loading') {
        return (
            <div className='auth-loading'>
                <div className='spinner' />
                <p>Checking authentication...</p>
            </div>
        );
    }
    
    return <>{children}</>;
};

// Session expiration notice component
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
        <div className='session-expiration-notice'>
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

// Error boundary for authentication errors
type AuthErrorBoundaryState = {
    hasError: boolean;
    error: Error | null;
};

export class AuthErrorBoundary extends React.Component<
    React.PropsWithChildren<Record<string, never>>,
    AuthErrorBoundaryState
> {
    constructor (props: React.PropsWithChildren<Record<string, never>>) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    
    static getDerivedStateFromError (error: Error): AuthErrorBoundaryState {
        return { hasError: true, error };
    }
    
    componentDidCatch (error: Error, errorInfo: React.ErrorInfo) {
        console.error('Authentication error:', error, errorInfo);
        
        // Report to monitoring service if available
        if ((window as any).analytics) {
            (window as any).analytics.track('Auth Error', {
                error: error.message,
                stack: error.stack,
                componentStack: errorInfo.componentStack
            });
        }
    }
    
    render () {
        if (this.state.hasError) {
            return (
                <div className='auth-error'>
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