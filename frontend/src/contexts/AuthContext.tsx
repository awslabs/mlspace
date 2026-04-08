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
import React, { useState, useEffect, useRef, useMemo, useCallback, createContext } from 'react';

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
    clearError: () => void;
};

enum AuthBroadcastMessageType {
    'AUTH_STATE_CHANGED',
    'SESSION_EXPIRED',
    'LOGOUT_INITIATED'
}

// Cross-tab synchronization message types
type AuthBroadcastMessage = { type: AuthBroadcastMessageType; senderId: string };

// Cross-tab synchronization manager
class AuthSyncManager {
    private channel: BroadcastChannel;
    private readonly id: string;
    private onStateChangeRef: { current: () => void };
    
    constructor (onStateChangeRef: { current: () => void }) {
        this.id = `auth-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        this.channel = new BroadcastChannel('mlspace-auth');
        this.onStateChangeRef = onStateChangeRef;
        this.channel.addEventListener('message', this.handleMessage);
    }
    
    private handleMessage = (event: MessageEvent<AuthBroadcastMessage>) => {
        // Ignore messages from this instance
        if (event.data.senderId === this.id) {
            return;
        }
        
        switch (event.data.type) {
            case AuthBroadcastMessageType.AUTH_STATE_CHANGED:
            case AuthBroadcastMessageType.SESSION_EXPIRED:
                this.onStateChangeRef.current();
                break;
            case AuthBroadcastMessageType.LOGOUT_INITIATED:
            // Immediate logout without API call (already done in originating tab)
                this.onStateChangeRef.current();
                break;
        }
    };
    
    broadcast (type: AuthBroadcastMessageType) {
        this.channel.postMessage({ type, senderId: this.id });
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
};

// AuthProvider component
export const AuthProvider: React.FC<AuthProviderProps> = ({
    children,
    checkInterval = 60000
}) => {
    const [state, setState] = useState<AuthState>({
        status: 'loading',
        user: null,
        session: null,
        error: null
    });
    
    // Cross-tab synchronization
    const syncManagerRef = useRef<AuthSyncManager>();
    const checkAuthStatusRef = useRef<() => void>();
    
    const checkAuthStatus = useCallback(async () => {
        const wasAuthenticated = state.status === 'authenticated';

        try {
            // Use axios-utils for standardized baseURL configuration
            const response = await axios.get('/auth/identity').catch(axiosCatch);

            setState({
                status: 'authenticated',
                user: response.data.user,
                session: response.data.session,
                error: null
            });
            
            // Broadcast auth state changes to other tabs
            if (!wasAuthenticated || response.data.session.refreshed) {
                syncManagerRef.current?.broadcast(AuthBroadcastMessageType.AUTH_STATE_CHANGED);
            }
        } catch (error: any) {
            if (error?.code === 401) {                
                setState({
                    status: 'unauthenticated',
                    user: null,
                    session: null,
                    error: null
                });
                
                // Broadcast session expiration to other tabs
                if (wasAuthenticated) {
                    syncManagerRef.current?.broadcast(AuthBroadcastMessageType.SESSION_EXPIRED);
                }
            } else {
                setState((prev) => ({
                    ...prev,
                    status: 'unauthenticated',
                    error: 'Failed to check authentication status'
                }));
            }
        }
    }, [state.status]);
    
    // Keep ref updated for AuthSyncManager
    useEffect(() => {
        checkAuthStatusRef.current = checkAuthStatus;
    }, [checkAuthStatus]);
    
    useEffect(() => {
        syncManagerRef.current = new AuthSyncManager(checkAuthStatusRef as { current: () => void });
        return () => {
            syncManagerRef.current?.destroy();
        };
    }, []);
    
    // Initial authentication check on mount
    useEffect(() => {
        checkAuthStatus();
    }, [checkAuthStatus]);
    
    // Periodic session validation
    useEffect(() => {
        const interval = setInterval(checkAuthStatus, checkInterval);
        return () => clearInterval(interval);
    }, [checkInterval, checkAuthStatus]);
    

    
    const login = () => {
        // For login redirect, we need to construct the full URL since it's a page redirect
        const baseUrl: string | undefined = (window as any).env?.LAMBDA_ENDPOINT || undefined;
        if (!baseUrl) {
            throw new Error('LAMBDA_ENDPOINT is not defined');
        }

        // Remove trailing slashes and extract the stage
        const stage = baseUrl.replace(/\/+$/, '').split('/').at(-1);
        const loginUrl = new URL(`${stage}/auth/login`, baseUrl.split(stage || '')[0]);
        
        loginUrl.searchParams.set('redirectUrl', `${window.location.origin}/${stage}`);

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
            syncManagerRef.current?.broadcast(AuthBroadcastMessageType.LOGOUT_INITIATED);
            
            // Redirect to IdP logout if provided
            if (response.data.idpLogoutUrl) {
                window.location.href = response.data.idpLogoutUrl;
            }
        } catch {
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