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

const setValueCloudscapeInput = (dataSelector: string, value: string) => {
    const input = createWrapper().findInput(`[data-cy="${dataSelector}"]`);
    cy.get(input.toSelector()).type(value);
};

const setValueCloudscapeTextArea = (dataSelector: string, value: string) => {
    const textArea = createWrapper().findTextarea(`[data-cy="${dataSelector}"]`);
    cy.get(textArea.toSelector()).type(value);
};

const setValueCloudscapeAutoSuggest = (dataSelector: string, value: string) => {
    const autoSuggest = createWrapper().findAutosuggest(`[data-cy="${dataSelector}"]`).findNativeInput();
    cy.get(autoSuggest.toSelector()).type(value);
};

const setValueCloudscapeSelect = (dataSelector: string, value: string) => {
    const select = createWrapper().findSelect(`[data-cy="${dataSelector}"]`);
    cy.get(select.toSelector()).click();
    cy.get(select.findDropdown().findOptionByValue(value).toSelector()).click();
};

const setValueCloudscapeMultiselect = (dataSelector: string, values: string[]): void => {
    const multiselect = createWrapper().findMultiselect(`[data-cy="${dataSelector}"]`);
    cy.get(multiselect.toSelector()).click();
    values.forEach((value) => {
        cy.get(multiselect.findDropdown().findOptionByValue(value).toSelector()).scrollIntoView();
        cy.get(multiselect.findDropdown().findOptionByValue(value).toSelector()).click();
    });
    cy.get('body').type('{esc}');
};

export const setValueCloudscapeS3SelectorInput = (dataSelector: string, value: string): void => {
    const selector = createWrapper().findS3ResourceSelector(`[data-cy="${dataSelector}"]`);
    cy.get(selector.findInContext().findUriInput().toSelector()).type(value);
};

export const setValueCloudscapeTile = (dataSelector: string, value: string): void => {
    const tiles = createWrapper().findTiles(`[data-cy="${dataSelector}"]`);
    cy.get(tiles.findItemByValue(value).toSelector()).click();
};

export const dismissNotification = (notificationText: string): void => {
    cy.contains(notificationText).get('[aria-label="Dismiss notification"]').click();
};

Cypress.Commands.add('setValueCloudscapeInput', (dataSelector: string, value: string) => {
    return setValueCloudscapeInput(dataSelector, value);
});

Cypress.Commands.add('setValueCloudscapeTextArea', (dataSelector: string, value: string) => {
    return setValueCloudscapeTextArea(dataSelector, value);
});

Cypress.Commands.add('setValueCloudscapeAutoSuggest', (dataSelector: string, value: string) => {
    return setValueCloudscapeAutoSuggest(dataSelector, value);
});

Cypress.Commands.add('setValueCloudscapeSelect', (dataSelector: string, value: string) => {
    return setValueCloudscapeSelect(dataSelector, value);
});

Cypress.Commands.add('setValueCloudscapeMultiselect', (dataSelector: string, values: string[]) => {
    return setValueCloudscapeMultiselect(dataSelector, values);
});