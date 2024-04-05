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