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
import { useAuth } from 'react-oidc-context';

// Mocking library for useAuth which is used in the auth-util
jest.mock('react-oidc-context');

// Mocked user authentication object
const validUserAuth = {
    'user': {
        'id_token': 'id.token.simulated-for-unit-testing-functions',
        'session_state': null,
        'access_token': 'simulated.access.token-for-unit-test--q-sim-functions',
        'refresh_token': 'refresh.token-simulated-for-unit.tests.and-demonstration-of-how-this-would-work-but-it-is-it-valid-nor-does-it-have-the-real-proper-number-of.characters',
        'token_type': 'Bearer',
        'scope': 'openid profile email',
        'profile': {
            'sub': '12345678-1234-1234-1234-1234567890ab',
            'iss': 'https://cognito-idp.us-east-2.amazonaws.com/us-east-2_asdfghjk',
            'cognito:username': 'co',
            'preferred_username': 'co',
            'origin_jti': '12345678-1234-1234-1234-1234567890ab',
            'aud': '1234567890asdfghjklzxcvbnm',
            'event_id': '12345678-1234-1234-1234-1234567890ab',
            'token_use': 'id',
            'name': 'co',
            'exp': 1715199886,
            'iat': 1715196286,
            'email': 'co@amazon.com'
        },
        'expires_at': 1715199886
    }
};

describe('Test useUsername', () => {
    test.concurrent('Valid user', async () => {
        useAuth.mockImplementation(() => {
            return validUserAuth;
        });

        expect(useUsername()).toBe('co');
    });

    test.concurrent('Invalid user', async () => {
        useAuth.mockImplementation(() => {
            return {};
        });

        expect(() => {
            useUsername();
        }).toThrow(Error);
    });
});
