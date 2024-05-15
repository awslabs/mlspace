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

import { ProjectCreate } from './project-create';

const testProjectName = `compTest${(new Date()).getTime()}`;
const testProjectDescription = 'This is an example project for component tests.';

it('Basic Test of Project Create', () => {
    // Mount the form
    cy.mount(
        <div>
            <ProjectCreate />
        </div>
        , {
            viewportProps: {
                width: 600,
                height: 600
            }
        }
    );

    // Register interceptor for creating a project
    cy.intercept('POST', '**/project', (request) => {
        // This function will process the intercepted request that is sent

        // The request body is a string and must be parsed to JSON
        const body = JSON.parse(request.body);

        // Check individual components of the request
        expect(body.description).eq(testProjectDescription);
        // Objects must use deep.equal to do nested comparisons
        expect(body.metadata).deep.eq({terminationConfiguration:{}});
        expect(body.name).eq(testProjectName);
        expect(body.suspended).eq(false);

        // Perform a full object comparison
        expect(body).to.deep.eq(
            {
                description: testProjectDescription,
                name: testProjectName,
                metadata: {
                    terminationConfiguration: {}
                },
                suspended: false
            }
        );

        // Sends a response with the given body as a 200 response
        request.reply(`Successfully created project ${testProjectName}`);
    })
        // Names the response so that it can be received and further processed with cy.wait('@submittedProject')
        .as('submittedProject');

    cy.get('[data-cy="name-input"] > input').type(testProjectName);
    cy.get('[data-cy="description-input"] > textarea').type(testProjectDescription);
    // Verify that the values have been updated
    cy.get('[data-cy="name-input"] > input').should('have.value', testProjectName);
    cy.get('[data-cy="description-input"] > textarea').should('have.value', testProjectDescription);

    cy.get('[data-cy="submit"]').click();

    // Process the response
    cy.wait('@submittedProject')
        .then((interception) => {
            cy.wrap(interception.response.statusCode).should('eq', 200);
        });
});