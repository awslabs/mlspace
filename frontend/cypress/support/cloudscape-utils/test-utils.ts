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

import createWrapper from '@cloudscape-design/components/test-utils/selectors';

const verifyCloudscapeInput = (dataSelector: string, value: string) => {
    const input = createWrapper().findInput(`[data-cy="${dataSelector}"]`);
    cy.get(input.findNativeInput().toSelector()).should('have.value', value);
};

const verifyCloudscapeTextArea = (dataSelector: string, value: string) => {
    const textArea = createWrapper().findTextarea(`[data-cy="${dataSelector}"]`);
    cy.get(textArea.findNativeTextarea().toSelector()).should('have.value', value);
};

const verifyCloudscapeAutoSuggest = (dataSelector: string, value: string) => {
    const autoSuggest = createWrapper().findAutosuggest(`[data-cy="${dataSelector}"]`);
    cy.get(autoSuggest.findNativeInput().toSelector()).should('have.value', value);
};

const verifyCloudscapeSelect = (dataSelector: string, value: string) => {
    const select = createWrapper().findSelect(`[data-cy="${dataSelector}"]`);
    cy.get(select.findTrigger().toSelector()).should('have.text', value);
};

// Verify the selected values by looking at the tokens
const verifyCloudscapeMultiselect = (dataSelector: string, values: string[]) => {
    const multiselect = createWrapper().findMultiselect(`[data-cy="${dataSelector}"]`);
    cy.get(multiselect.findTokens().toSelector()).then(($el) => {
        const tokenValues = $el.toArray().map((el) => el.textContent);
        expect(tokenValues).to.eql(values);
    });
};

export const verifyValueCloudscapeS3SelectorInput = (dataSelector: string, value: string): void => {
    const selector = createWrapper().findS3ResourceSelector(`[data-cy="${dataSelector}"]`);
    cy.get(selector.findInContext().findUriInput().findNativeInput().toSelector()).should('have.value', value);
};

export const verifyValueCloudscapeTile = (dataSelector: string, value: string): void => {
    const tiles = createWrapper().findTiles(`[data-cy="${dataSelector}"]`);
    cy.get(tiles.findItemByValue(value).findNativeInput().toSelector()).should('be.checked');
};

const verifySelectCloudscapeTableRow = (dataSelector: string) => {
    cy.get(createWrapper().find(`[data-cy="${dataSelector}"]`).toSelector()).parent().parent().scrollIntoView();
    cy.get('[type=checkbox]').should('be.checked');
};

Cypress.Commands.add('verifyCloudscapeInput', (dataSelector: string, value: string) => {
    return verifyCloudscapeInput(dataSelector, value);
});

Cypress.Commands.add('verifyCloudscapeTextArea', (dataSelector: string, value: string) => {
    return verifyCloudscapeTextArea(dataSelector, value);
});

Cypress.Commands.add('verifyCloudscapeAutoSuggest', (dataSelector: string, value: string) => {
    return verifyCloudscapeAutoSuggest(dataSelector, value);
});

Cypress.Commands.add('verifyCloudscapeSelect', (dataSelector: string, value: string) => {
    return verifyCloudscapeSelect(dataSelector, value);
});

Cypress.Commands.add('verifyCloudscapeMultiselect', (dataSelector: string, values: string[]) => {
    return verifyCloudscapeMultiselect(dataSelector, values);
});

Cypress.Commands.add('verifySelectCloudscapeTableRow', (dataSelector: string) => {
    return verifySelectCloudscapeTableRow(dataSelector);
});