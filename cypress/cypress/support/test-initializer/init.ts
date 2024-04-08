import { AUTH_TYPE, BASE_URL, DEFAULT_USERNAME, DEFAULT_PASSWORD } from '../commands';
import { AuthType, TestProps } from './types';

const initializeTest = (props: TestProps) => {
    Cypress.session.clearAllSavedSessions();
    const { login, projects, datasets, projectPrefix } = props;
    if (login) {
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

    if (projectPrefix){
        cy.deleteProjectsWithPrefix(projectPrefix);
    }
    
    projects?.forEach((project) => {
        cy.createProject(project);
    });
    datasets?.forEach((dataset) => {
        cy.createDataset(dataset);
    });
};

const teardownTest = (props: TestProps) => {
    const { projects, datasets } = props;
    datasets?.forEach((dataset) => {
        cy.deleteDataset(dataset.name);
    });
    projects?.forEach((project) => {
        cy.deleteProject(project.name);
    });
};

Cypress.Commands.add('initializeTest', (props: TestProps) => {
    return initializeTest(props);
});

Cypress.Commands.add('teardownTest', (props: TestProps) => {
    return teardownTest(props);
});