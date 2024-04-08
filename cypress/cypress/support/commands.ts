import './auth-provider-commands/keycloak';
import './auth-provider-commands/mockIdp';
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
export const DEFAULT_USERNAME = Cypress.env('username');
export const DEFAULT_PASSWORD = Cypress.env('password');

export function login (baseUrl: string = BASE_URL, username: string = DEFAULT_USERNAME, password: string = DEFAULT_PASSWORD) {
    if (AUTH_TYPE === AuthType.Cognito) {
        cy.loginToCognito(
            BASE_URL,
            DEFAULT_USERNAME,
            DEFAULT_PASSWORD
        );
    } else if (AUTH_TYPE === AuthType.Idp) {
        cy.loginByMockIdP(
            BASE_URL,
            DEFAULT_USERNAME,
            DEFAULT_PASSWORD
        );
    }
}

export function capitalizeFirstLetter (value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}