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

import { describe, test, expect } from '@jest/globals';
import { useUsername } from './auth-utils';
import { useAuth } from '../auth/hooks';

// Mocking library for useAuth which is used in the auth-util
jest.mock('../auth/hooks');

// Mocked user authentication object
const validUserAuth = {
    status: 'authenticated' as const,
    user: {
        id: 'co',
        displayName: 'co',
        email: 'co@amazon.com',
        groups: [],
        attributes: {}
    },
    session: {
        expiresAt: '2024-01-15T10:30:00Z',
        refreshAt: '2024-01-15T09:30:00Z',
        provider: 'oidc'
    },
    error: null,
    login: jest.fn(),
    logout: jest.fn(),
    refresh: jest.fn(),
    clearError: jest.fn()
};

describe('Test useUsername', () => {
    test.concurrent('Valid user', async () => {
        (useAuth as jest.Mock).mockImplementation(() => {
            return validUserAuth;
        });

        expect(useUsername()).toBe('co');
    });

    test.concurrent('Invalid user', async () => {
        (useAuth as jest.Mock).mockImplementation(() => {
            return {
                ...validUserAuth,
                user: null
            };
        });

        expect(() => {
            useUsername();
        }).toThrow(Error);
    });
});
