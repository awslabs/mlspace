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

import createWrapper, { ButtonWrapper } from '@cloudscape-design/components/test-utils/selectors';

const setValueCloudscapeTextFilter = (dataSelector: string, value: string) => {
    cy.get(createWrapper().findTable(`[data-cy="${dataSelector}"]`).findFilterSlot().toSelector()).type(value);
};

const clearCloudscapeTextFilter = (dataSelector: string) => {
    cy.get(createWrapper().findTable(`[data-cy="${dataSelector}"]`).findFilterSlot().findComponent('button', ButtonWrapper).toSelector()).click();
};

const selectCloudscapeTableRow = (dataSelector: string) => {
    const selector = createWrapper().find(`[data-cy="${dataSelector}"]`).toSelector();
    cy.get(selector).parent().parent().scrollIntoView();
    cy.get(selector).get('[type=checkbox]').check();
};



Cypress.Commands.add('setValueCloudscapeTextFilter', (dataSelector: string, value: string) => {
    return setValueCloudscapeTextFilter(dataSelector, value);
});

Cypress.Commands.add('clearCloudscapeTextFilter', (dataSelector: string) => {
    return clearCloudscapeTextFilter(dataSelector);
});

Cypress.Commands.add('selectCloudscapeTableRow', (dataSelector: string) => {
    return selectCloudscapeTableRow(dataSelector);
});