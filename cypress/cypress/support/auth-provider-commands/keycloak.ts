const loginToKeycloak = (baseUrl: string, username: string, password: string) => {
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
                'https://ec2-52-55-68-28.compute-1.amazonaws.com/',
                {
                    args: {
                        username,
                        password,
                    },
                },
                ({ username, password }) => {
                    // Cognito log in page has some elements of the same id but are off screen.
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
                    .invoke('getItem', 'oidc.user:https://ec2-52-55-68-28.compute-1.amazonaws.com/realms/mlspace:web-client')
                    .should('exist');

            }
        }
    );
    log.snapshot('after');
    log.end();
};



// right now our custom command is light. More on this later!
Cypress.Commands.add('loginByKeycloak', (baseUrl: string, username: string, password: string) => {
    return loginToKeycloak(baseUrl, username, password);
});
