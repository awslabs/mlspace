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

import { verifyValueCloudscapeTile } from '../support/cloudscape-utils/test-utils';
import { setValueCloudscapeTile } from '../support/cloudscape-utils/utils';
import { BASE_URL, DEFAULT_USERNAME } from '../support/commands';
import { TestProps } from '../support/test-initializer/types';

describe('GroundTruth Labeling Job Tests', () => {
    const now = (new Date()).getTime();
    const testProjectName = `e2eTest${now}`;
    const testProjectDescription = 'This is an example project for E2E tests.';
    const bucketName = 'mlspace-bucket';
    const datasetKey = `project/${testProjectName}/datasets/dataset/e2eTestDatasetIn${now}.manifest`;
    const testManifestFile = `s3://${bucketName}/${datasetKey}`;
    const testDatasetNameOut = `s3://${bucketName}/project/${testProjectName}/datasets/dataset/`;
    const testLabelingJobName = `e2eTestLabelingJob${now}`;
    const testLabelingJobDescription = `${now}: Perform labeling job.`;
    const testWorkTeams = [{
        'WorkteamName': 'MLSpaceDemo',
        'WorkteamArn': 'not:an:arn'
    }
    ];
    const presignedUrl = `https://${bucketName}.s3.amazonaws.com/project/${testProjectName}/datasets/dataset/e2eTestDatasetIn${now}.manifest`;
    const testManifestFileContent = '{"source":"Test line 1"}\n{"source":"Test line 2}';
    const label0 = 'Label 0';
    const label1 = 'Label 1';
    const testProps: TestProps = {
        login: true,
    };

    /* eslint-disable spellcheck/spell-checker */
    const knownAccessibilityDefects = [
        'The aria-rowindex attribute is not allowed on this TR'
    ] as string[];
    /* eslint-enable spellcheck/spell-checker */

    const fakeCreatedJob = {
        'LabelingJobStatus': 'InProgress',
        'LabelCounters': {
            'TotalLabeled': 0,
            'HumanLabeled': 0,
            'MachineLabeled': 0,
            'FailedNonRetryableError': 0,
            'Unlabeled': 6
        },
        'CreationTime': '2024-01-11 16:55:32.835000+00:00',
        'LastModifiedTime': '2024-01-21 17:04:02.091000+00:00',
        'JobReferenceCode': 'mockReferenceCode',
        'LabelingJobName': testLabelingJobName,
        'LabelingJobArn': `arn:aws:sagemaker:us-east-1:123456789012:labeling-job/${testLabelingJobName}`,
        'LabelAttributeName': testLabelingJobName,
        'InputConfig': {
            'DataSource': {
                'S3DataSource': {
                    // eslint-disable-next-line spellcheck/spell-checker
                    'ManifestS3Uri': 's3://mlspace-data-123456789012/global/datasets/AircraftImages/dataset-aircraftlabelingmanifest.manifest'
                }
            }
        },
        'OutputConfig': {
            'S3OutputPath': 's3://mlspace-data-123456789012/global/datasets/AircraftImages',
            'KmsKeyId': ''
        },
        // eslint-disable-next-line spellcheck/spell-checker
        'RoleArn': 'arn:aws:iam::123456789012:role/MLSpace-DemoProject1-132f8610d7775fd995226598a19c912fa5fb15df75',
        'LabelCategoryConfigS3Uri': `s3://mlspace-data-123456789012/global/datasets/AircraftImages/${testLabelingJobName}/annotation-tool/data.json`,
        'StoppingConditions': {
            'MaxPercentageOfInputDatasetLabeled': 100
        },
        'HumanTaskConfig': {
            'WorkteamArn': 'arn:aws:sagemaker:us-east-1:123456789012:workteam/private-crowd/TeamAWorkforce',
            'UiConfig': {
                'UiTemplateS3Uri': `s3://mlspace-data-123456789012/global/datasets/AircraftImages/${testLabelingJobName}/annotation-tool/template.liquid`
            },
            'PreHumanTaskLambdaArn': 'arn:aws:lambda:us-east-1:432418664414:function:PRE-ImageMultiClass',
            'TaskKeywords': [
                'Images',
                'categorization',
                'classification'
            ],
            'TaskTitle': 'Image Classification (Single Label): Select the label that matches the image',
            'TaskDescription': 'Categorize images into individual classes.',
            'NumberOfHumanWorkersPerDataObject': 2,
            'TaskTimeLimitInSeconds': 600,
            'TaskAvailabilityLifetimeInSeconds': 864000,
            'MaxConcurrentTaskCount': 1000,
            'AnnotationConsolidationConfig': {
                'AnnotationConsolidationLambdaArn': 'arn:aws:lambda:us-east-1:432418664414:function:ACS-ImageMultiClass'
            }
        },
    };

    before(() => {
        cy.initializeTest(testProps);
    });

    after(() => {
        cy.teardownTest(testProps);
    });

    beforeEach(() => {
        cy.intercept('GET', `**/project/${testProjectName}**`, {
            project: {
                name: testProjectName,
                description: testProjectDescription,
                suspended: false,
                createdBy: DEFAULT_USERNAME,
                createdAt: Date.now(),
                lastUpdatedAt: Date.now(),
                resourceCounts: {
                    'batch-translate-job': {
                        'Total': 0
                    },
                    'cluster': {
                        'Total': 0
                    },
                    'endpoint': {
                        'Total': 0
                    },
                    'endpoint-config': {
                        'Total': 0
                    },
                    'hpo-job': {
                        'Total': 0
                    },
                    'labeling-job': {
                        'Total': 0
                    },
                    'model': {
                        'Total': 0
                    },
                    'notebook-instance': {
                        'Total': 0
                    },
                    'training-job': {
                        'Total': 0
                    },
                    'transform-job': {
                        'Total': 0
                    }
                }
            }
        });
        cy.visit(`${BASE_URL}/#/project/${testProjectName}`);
    });

    it('Create Labeling Job', () => {
        // Register interceptors
        cy.intercept('GET', `**/${testProjectName}/jobs/labeling`, { records: [] });
        cy.intercept('GET', `**/${testProjectName}/jobs/labeling/teams`, testWorkTeams);
        cy.intercept('GET', `**/${testProjectName}/jobs/labeling/${testLabelingJobName}`, fakeCreatedJob);
        cy.intercept('GET', '**/bucket-name', bucketName);
        cy.intercept('POST', '**/presigned-url', (req) => {
            const { body } = req;
            expect(body['key']).to.equal(datasetKey);
            req.reply({ statusCode: 200, body: presignedUrl });
        });
        cy.intercept('GET', presignedUrl, testManifestFileContent);
        cy.intercept('POST', '**/job/labeling', (req) => {
            const { body } = req;
            expect(req.headers['x-mlspace-project']).to.equal(testProjectName);
            expect(body['TaskType']).to.equal('TextMultiClassMultiLabel');
            expect(body['Description']).to.equal(testLabelingJobDescription);
            expect(body['Labels']).to.eql([{ 'label': label0 }, { 'label': label1 }]);
            const job = body['JobDefinition'];
            expect(job['HumanTaskConfig']['WorkteamArn']).to.equal(testWorkTeams[0]['WorkteamArn']);
            expect(job['InputConfig']['DataSource']['S3DataSource']['ManifestS3Uri']).to.equal(testManifestFile);
            expect(job['OutputConfig']['S3OutputPath']).to.equal(testDatasetNameOut);

            req.reply({ statusCode: 200 });
        });

        cy.contains('Ground Truth').click();
        cy.contains('Labeling jobs').click();
        cy.url().should('include', '/labeling');
        cy.contains('Create new labeling job').click();
        cy.url().should('include', '/labeling/create');
        // Input values into labeling job details
        cy.setValueCloudscapeInput('name-input', testLabelingJobName);
        cy.setValueCloudscapeInput('manifest-file-input', testManifestFile);
        cy.setValueCloudscapeInput('output-location-input', testDatasetNameOut);
        cy.setValueCloudscapeSelect('task-category-select', 'Text');
        setValueCloudscapeTile('task-selection-tiles', 'TextMultiClassMultiLabel');
        // Verify that the labeling job details have been updated
        cy.verifyCloudscapeInput('name-input', testLabelingJobName);
        cy.verifyCloudscapeInput('manifest-file-input', testManifestFile);
        cy.verifyCloudscapeInput('output-location-input', testDatasetNameOut);
        cy.verifyCloudscapeSelect('task-category-select', 'Text');
        verifyValueCloudscapeTile('task-selection-tiles', 'TextMultiClassMultiLabel');
        // Go to the next page
        cy.contains('Next').scrollIntoView().click();
        // Input values into the labeling job workers section
        cy.setValueCloudscapeSelect('private-team-select', testWorkTeams[0]['WorkteamArn']);
        cy.setValueCloudscapeTextArea('description-textarea', testLabelingJobDescription);
        cy.setValueCloudscapeInput('label-0', label0);
        cy.setValueCloudscapeInput('label-1', label1);

        // Verify values of the labeling job workers section
        cy.verifyCloudscapeSelect('private-team-select', testWorkTeams[0]['WorkteamName']);
        cy.verifyCloudscapeTextArea('description-textarea', testLabelingJobDescription);
        cy.verifyCloudscapeInput('label-0', label0);
        cy.verifyCloudscapeInput('label-1', label1);

        cy.contains('Create labeling job').scrollIntoView().click();
        cy.contains(`Successfully created labeling job with name [${testLabelingJobName}]`);

        // Verify redirect to labeling job details page
        cy.url().should('include', `#/project/${testProjectName}/jobs/labeling/${testLabelingJobName}`);

    });
});