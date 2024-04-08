const getTopLevelDomain = (url: string): string => {
    const parts = url.split('/');
    return parts[2];
};


const getTopLevelDomain = (url: string): string => {
    const parts = url.split('/');
    return parts[2];
};

const loginToMockIdP = (baseUrl: string, username: string, password: string) => {
    const log = Cypress.log({
        displayName: 'Mock IdP Login',
        message: [`🔐 Authenticating | ${username}`],
        autoEnd: false,
    });
    let idpOrigin = '';
    log.snapshot('before');
    // Temporarily suppress exceptions. We expect to get 401's which will trigger the login redirect
    cy.on('uncaught:exception', () => {
        return false;
    });
    cy.session(
        `mock-idp-${username}`,
        () => {
            cy.visit(baseUrl);
            cy.request(baseUrl + '/env.js').then((resp) => {
                const OIDC_URL_REGEX = /["']OIDC_URL['"]:\s*['"]([A-Za-z:\-./0-9]+)['"]/;
                const matches = OIDC_URL_REGEX.exec(resp.body);
                if (matches && matches.length === 2) {
                    idpOrigin = matches[1];
                }
                // const getTopLevelDomain = (url: string): string => {
                //     const parts = url.split('.');
                //     return parts[parts.length - 2];
                // };
                // if (getTopLevelDomain(baseUrl) === getTopLevelDomain(idpOrigin)) {
                //     cy.get('#username').type(username);
                //     cy.get('#password').type(password, {
                //         // use log: false to prevent your password from showing in the Command Log
                //         log: false,
                //     });

                //     cy.get('#btnLogin').click();
                // } else {
                cy.origin(
                    idpOrigin,
                    {
                        args: {
                            username,
                            password,
                        },
                    },
                    ({ username, password }) => {
                        cy.get('#username').type(username);
                        cy.get('#password').type(password, {
                            // use log: false to prevent your password from showing in the Command Log
                            log: false,
                        });

                        cy.get('#btnLogin').click();
                    }
                );
                cy.wait(2000);
                cy.url().should('equal', baseUrl);
                cy.clearAllCookies();
            });

        },
        {
            validate: () => {
                cy.wrap(sessionStorage)
                    .invoke('getItem', `oidc.user:${idpOrigin}:web-client`)
                    .should('exist');

            }
        }
    );
    log.snapshot('after');
    log.end();
};

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
                const OIDC_URL_REGEX = /["']OIDC_URL['"]:\s*['"]([A-Za-z:\-._/0-9]+)['"]/;
                const OIDC_APP_NAME_REGEX = /["']OIDC_CLIENT_NAME['"]:\s*['"]([A-Za-z:\-._/0-9]+)['"]/;
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
                    cy.wait(2000);
                    cy.url().should('equal', baseUrl);
                });
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



Cypress.Commands.add('loginToCognito', (baseUrl: string, username: string, password: string) => {
    return loginToCognito(baseUrl, username, password);
});



Cypress.Commands.add('loginByMockIdP', (baseUrl: string, username: string, password: string) => {
    return loginToMockIdP(baseUrl, username, password);
});
