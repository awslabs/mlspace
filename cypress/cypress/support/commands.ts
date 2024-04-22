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

import './auth-provider-commands/keycloak';
import './auth-provider-commands/mockIdp';
import './auth-provider-commands/cognito';
import './cloudscape-utils/utils';
import './cloudscape-utils/test-utils';
import './test-initializer/init';
import './project-commands/project';
import './dataset-commands/dataset';
import './table-commands/table';
import 'cypress-file-upload';
import { AuthType } from './test-initializer/types';

export const AUTH_TYPE = Cypress.env('auth_type');
export const BASE_URL = Cypress.env('base_url');
// This is only used if BASE_URL targets a "localhost" implementation (e.g. "http://localhost:3000/Prod")
export const LAMBDA_ENDPOINT = Cypress.env('lambda_endpoint');
export const DEFAULT_USERNAME = Cypress.env('username');
export const DEFAULT_PASSWORD = Cypress.env('password');

export function login (baseUrl: string = BASE_URL, username: string = DEFAULT_USERNAME, password: string = DEFAULT_PASSWORD) {
    if (AUTH_TYPE === AuthType.Cognito) {
        cy.loginByCognito(
            baseUrl,
            username,
            password
        );
    } else if (AUTH_TYPE === AuthType.Idp) {
        cy.loginByMockIdP(
            baseUrl,
            username,
            password
        );
    }
}

export function capitalizeFirstLetter (value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}