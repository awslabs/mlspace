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

import { AUTH_TYPE, BASE_URL, DEFAULT_USERNAME, DEFAULT_PASSWORD } from '../commands.tsx';
import { AuthType, TestProps } from './types';

let resizerErrorIframeClosed = false;

const initializeTest = (props: TestProps) => {
    Cypress.session.clearAllSavedSessions();
    const { login, projects, datasets, projectPrefix } = props;
    if (login) {
        if (AUTH_TYPE === AuthType.Cognito) {
            cy.loginByCognito(
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

    const resizeObserverLoopErrRe = /^[^(ResizeObserver loop limit exceeded)]/;
    Cypress.on('uncaught:exception', (err) => {
        /* returning false here prevents Cypress from failing the test */
        if (resizeObserverLoopErrRe.test(err.message)) {
            if (!resizerErrorIframeClosed) {
                cy.get('iframe').invoke('remove');
                resizerErrorIframeClosed = true;
            }
            return false;
        }
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