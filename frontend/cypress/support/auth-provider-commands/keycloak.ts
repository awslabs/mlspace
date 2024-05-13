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

const loginToKeycloak = (baseUrl: string, keyCloakUrl: string, username: string, password: string) => {
    const log = Cypress.log({
        displayName: 'Keycloak LOGIN',
        message: [`🔐 Authenticating | ${username}`],
        autoEnd: false,
    });
    log.snapshot('before');
    // Temporarily suppress exceptions. We expect to get 401's which will trigger the login redirect
    cy.on('uncaught:exception', () => {
        return false;
    });
    cy.session(
        `keycloak-${username}`,
        () => {
            cy.visit(baseUrl);
            cy.origin(
                keyCloakUrl,
                {
                    args: {
                        username,
                        password,
                    },
                },
                ({ username, password }) => {
                    // We only want the visible elements to log in
                    cy.get('input[name="username"]:visible').type(username);
                    cy.get('input[name="password"]:visible').type(password, {
                        // use log: false to prevent your password from showing in the Command Log
                        log: false,
                    });
                    cy.get('input[name="login"]:visible').click();
                }
            );
            cy.wait(2000);
            cy.url().should('equal', baseUrl);
            cy.clearAllCookies();

        },
        {
            validate: () => {
                cy.wrap(sessionStorage)
                    .invoke('getItem', `oidc.user:${keyCloakUrl}realms/mlspace:web-client`)
                    .should('exist');

            }
        }
    );
    log.snapshot('after');
    log.end();
};



// right now our custom command is light. More on this later!
Cypress.Commands.add('loginByKeycloak', (baseUrl: string, keyCloakUrl: string, username: string, password: string) => {
    return loginToKeycloak(baseUrl, keyCloakUrl, username, password);
});
