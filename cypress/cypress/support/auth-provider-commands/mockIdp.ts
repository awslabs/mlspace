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


Cypress.Commands.add('loginByMockIdP', (baseUrl: string, username: string, password: string) => {
    return loginToMockIdP(baseUrl, username, password);
});
