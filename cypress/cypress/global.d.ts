declare namespace Cypress {
    type Chainable = {
        loginByKeycloak(baseUrl: string, username: string, password: string): Chainable<Response>;
        loginByMockIdP(baseUrl: string, username: string, password: string): Chainable<Response>;
        getAccessibilityDefects(): Chainable<Array<any>>;
        setValueCloudscapeInput(dataSelector: string, value: string): Chainable<Response>;
        setValueCloudscapeTextArea(dataSelector: string, value: string): Chainable<Response>;
        setValueCloudscapeAutoSuggest(dataSelector: string, value: string): Chainable<Response>;
        setValueCloudscapeSelect(dataSelector: string, value: string): Chainable<Response>;
        setValueCloudscapeMultiselect(dataSelector: string, values: string[]): Chainable<Response>;
        setValueCloudscapeTextFilter(dataSelector: string, value: string): Chainable<Response>;
        clearCloudscapeTextFilter(dataSelector: string);
        selectCloudscapeTableRow(dataSelector: string): Chainable<Response>;
        verifyCloudscapeInput(dataSelector: string, value: string): Chainable<Response>;
        verifyCloudscapeTextArea(dataSelector: string, value: string): Chainable<Response>;
        verifyCloudscapeAutoSuggest(dataSelector: string, value: string): Chainable<Response>;
        verifyCloudscapeSelect(dataSelector: string, value: string): Chainable<Response>;
        verifyCloudscapeMultiselect(dataSelector: string, values: string[]): Chainable<Response>;
        verifySelectCloudscapeTableRow(dataSelector: string): Chainable<Response>;
        initializeTest(props: TestProps): Chainable<Response>;
        teardownTest(props: TestProps): Chainable<Response>;
        createProject(props: ProjectProps): Chainable<Response>;
        deleteProject(projectName: string): Chainable<Response>;
        deleteProjectsWithPrefix(projectPrefix: string): Chainable<Response>;
        createDataset(props: DatasetProps): Chainable<Response>;
        deleteDataset(datasetName: string): Chainable<Response>;
    };
}