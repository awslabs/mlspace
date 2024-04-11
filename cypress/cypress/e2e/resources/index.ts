export const notebookInstance = {
    NotebookInstanceName: '',
    NotebookInstanceArn: '',
    NotebookInstanceStatus: 'Pending',
    Url: '',
    InstanceType: 'ml.t3.xlarge',
    CreationTime: '2023-01-10 21:48:53.708000+00:00',
    LastModifiedTime: '2023-01-10 21:53:03.863000+00:00',
    NotebookInstanceLifecycleConfigName: 'No configuration',
    VolumeSizeInGB: 5,
    Owner: Cypress.env('username')
};

export const newNotebookInstance = {
    NotebookInstanceName: '',
    InstanceType: 'ml.t3.xlarge',
    NotebookInstanceLifecycleConfigName: 'No configuration',
    VolumeSizeInGB: 5
};

export const notebookOptions = {
    lifecycleConfigs: ['No configuration']
};

export const computeTypes = {
    InstanceTypes: {
        InstanceType: [
            'ml.t2.medium',
            'ml.t2.large',
            'ml.t2.xlarge',
            'ml.t3.medium',
            'ml.t3.large',
            'ml.t3.xlarge',
        ]
    }
};

export const project = {
    project: {
        name: '',
        description: 'E2E test project',
        suspended: false,
        createdBy: 'mo',
        createdAt: 1668113755,
        lastUpdatedAt: 1668113755
    },
    permissions: ['CO']
};

export const dataset = {
    DatasetName: 'E2EDatasetTest',
    DatasetDescription: 'E2E test dataset',
    DatasetType: 'Global',
    DatasetFormat: 'text/plain',
};