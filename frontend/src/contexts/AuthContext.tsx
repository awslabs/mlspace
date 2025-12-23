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
import React, { useState, useEffect, useRef, useMemo, createContext } from 'react';

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
export const AuthContext = createContext<AuthContextValue | null>(null);

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

// Custom hooks for consuming the context are now in shared/auth/hooks.ts
// Import them from there: import { useAuth, useUser, useAuthStatus, useRequireAuth } from '../shared/auth/hooks';

// Authentication components are now in shared/auth/components.tsx
// Import them from there: import { ProtectedRoute, AuthLoadingWrapper, SessionExpirationNotice, AuthErrorBoundary } from '../shared/auth/components';