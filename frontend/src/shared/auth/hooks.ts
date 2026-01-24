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

import { useContext, useEffect } from 'react';
import { AuthContext, AuthContextValue } from '../../contexts/AuthContext';

/**
 * Hook to access the authentication context
 * @returns AuthContextValue containing auth state and actions
 * @throws Error if used outside of AuthProvider
 */
export const useAuth = (): AuthContextValue => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

/**
 * Convenience hook to get the current user
 * @returns Current authenticated user or null
 */
export const useUser = () => {
    const { user } = useAuth();
    return user;
};

/**
 * Convenience hook to get the current authentication status
 * @returns Authentication status: 'loading' | 'authenticated' | 'unauthenticated'
 */
export const useAuthStatus = () => {
    const { status } = useAuth();
    return status;
};

/**
 * Hook that automatically redirects to login if user is not authenticated
 * @returns boolean indicating if user is authenticated
 */
export const useRequireAuth = () => {
    const { status, login } = useAuth();
    
    useEffect(() => {
        if (status === 'unauthenticated') {
            login();
        }
    }, [status, login]);
    
    return status === 'authenticated';
};

/**
 * Hook to check if user has any of the required groups
 * @param requiredGroups Array of group names that grant access
 * @returns boolean indicating if user has required access
 */
export const useHasGroups = (requiredGroups: string[]) => {
    const { user } = useAuth();
    
    if (!user || requiredGroups.length === 0) {
        return true; // No groups required or no user
    }
    
    return requiredGroups.some((group) => user.groups.includes(group));
};

/**
 * Hook to check if user has a specific group
 * @param group Group name to check
 * @returns boolean indicating if user has the group
 */
export const useHasGroup = (group: string) => {
    return useHasGroups([group]);
};

/**
 * Hook to get user attributes
 * @returns User attributes object or empty object if no user
 */
export const useUserAttributes = () => {
    const { user } = useAuth();
    return user?.attributes || {};
};

/**
 * Hook to get a specific user attribute
 * @param attributeName Name of the attribute to retrieve
 * @returns Attribute value or undefined if not found
 */
export const useUserAttribute = (attributeName: string) => {
    const attributes = useUserAttributes();
    return attributes[attributeName];
};