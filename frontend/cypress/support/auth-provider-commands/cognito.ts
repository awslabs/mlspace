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

import { getTopLevelDomain } from './auth-provider-utils';

const loginToCognito = (baseUrl: string, username: string, password: string) => {
    const log = Cypress.log({
        displayName: 'Mock IdP Login',
        message: [`🔐 Authenticating | ${username}`],
        autoEnd: false,
    });
    let cognitoOathEndpoint = '';
    let cognitoOathClientName = '';
    let cognitoAuthEndpoint = '';
    log.snapshot('before');
    // Temporarily suppress exceptions. We expect to get 401's which will trigger the login redirect
    cy.on('uncaught:exception', () => {
        return false;
    });
    cy.session(
        `cognito-${username}`,
        () => {
            // Handle cognito portal information
            cy.request(baseUrl + '/env.js').then((resp) => {
                const OIDC_URL_REGEX = /["']?OIDC_URL['"]?:\s*['"]?([A-Za-z:\-._/0-9]+)['"]?/;
                const OIDC_APP_NAME_REGEX = /["']?OIDC_CLIENT_NAME['"]?:\s*['"]?([A-Za-z:\-._/0-9]+)['"]?/;
                const oidcUrlMatches = OIDC_URL_REGEX.exec(resp.body);
                if (oidcUrlMatches && oidcUrlMatches.length === 2) {
                    cognitoOathEndpoint = oidcUrlMatches[1];
                }
                const oidcClientNameMatches = OIDC_APP_NAME_REGEX.exec(resp.body);
                if (oidcClientNameMatches && oidcClientNameMatches.length === 2) {
                    cognitoOathClientName = oidcClientNameMatches[1];
                }
                cy.request(`${cognitoOathEndpoint}/.well-known/openid-configuration`).then((oathResponse) => {
                    cognitoAuthEndpoint = getTopLevelDomain(oathResponse.body.authorization_endpoint);

                    // click the login link
                    cy.visit(baseUrl);
                    cy.contains('button', 'Login').click();
                    //authOrigin = cy.location('origin');
                    cy.origin(
                        cognitoAuthEndpoint,
                        {
                            args: {
                                username,
                                password,
                            },
                        },
                        ({ username, password }) => {
                            cy.get('input[name="username"]').filter(':visible').type(username, {force: true});
                            cy.get('input[name="password"]').filter(':visible').type(password, {force: true});
                            cy.get('input[value="Sign in"]').filter(':visible').click({force: true});
                        }
                    );
                });
                cy.wait(2000);
            });
        },
        {
            validate: () => {
                cy.wrap(sessionStorage)
                    .invoke('getItem', `oidc.user:${cognitoOathEndpoint}:${cognitoOathClientName}`)
                    .should('exist');

            }
        }
    );
    log.snapshot('after');
    log.end();
};


Cypress.Commands.add('loginByCognito', (baseUrl: string, username: string, password: string) => {
    return loginToCognito(baseUrl, username, password);
});