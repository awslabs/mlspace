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

import {
    Header,
    SpaceBetween,
    FormField,
    Input,
    Container,
    RadioGroup,
    ExpandableSection,
    Link,
    Autosuggest,
} from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Condition from '../../../../modules/condition';
import Modal from '../../../../modules/modal';
import { useAppDispatch, useAppSelector } from '../../../../config/store';
import { IModelContainer, IModelContainerMode } from '../../../../shared/model/container.model';
import { ModifyMethod } from '../../../../shared/validation/modify-method';
import { getImageURIs, loadingImageURIs, toggleSelectTrainingJobModal } from '../../model.reducer';
import { SetFieldsFunction, TouchFieldsFunction } from '../../../../shared/validation';
import { describeTrainingJob } from '../../../jobs/training/training-job.reducer';
import { TrainingJobResourceMetadata } from '../../../../shared/model/resource-metadata.model';
import { TrainingJobsTable } from '../../../jobs/training/training-jobs.table';
import { JobStatus } from '../../../jobs/job.model';
import { EnvironmentVariables } from '../../../../modules/environment-variables/environment-variables';
import { generateNameConstraintText } from '../../../../shared/util/form-utils';

export type CreateModelContainerProps = {
    state: IModelContainer;
    errors: any;
    setFields: SetFieldsFunction;
    touchFields: TouchFieldsFunction;
};

function CreateModelContainer (props: CreateModelContainerProps) {
    const imageURIs = useAppSelector((state) => state.model.imageURIs);
    const loadingImageOptions = useAppSelector(loadingImageURIs);
    const selectTrainingJobModalVisible: boolean = useAppSelector(
        (state) => state.model.selectTrainingJobModalVisible
    );
    const [selectedJob, setSelectedJob] = useState({} as TrainingJobResourceMetadata);
    const { projectName } = useParams();
    const dispatch = useAppDispatch();

    const { state, errors, setFields, touchFields } = props;

    useEffect(() => {
        dispatch(getImageURIs());
    }, [dispatch, projectName]);

    const generateHeader = () => {
        return (
            <Header variant='h2' actions=''>
                {state.name}
            </Header>
        );
    };

    return (
        <Container header={generateHeader()}>
            <ExpandableSection
                headerText='Provide model artifacts and inference image options'
                headingTagOverride='h3'
                defaultExpanded={true}
            >
                <SpaceBetween direction='vertical' size='xxl'>
                    <FormField>
                        <RadioGroup
                            onChange={({ detail }) => {
                                const toSet = { Mode: detail.value } as any;
                                if (
                                    detail.value === IModelContainerMode.SINGLE_MODEL &&
                                    !state.ModelDataUrl
                                ) {
                                    toSet.ModelDataUrl = '';
                                }
                                setFields(toSet);

                                if (
                                    detail.value === IModelContainerMode.MULTI_MODEL &&
                                    state.ModelDataUrl === ''
                                ) {
                                    setFields({ ModelDataUrl: true }, ModifyMethod.Unset);
                                }
                            }}
                            value={state.Mode!}
                            items={[
                                {
                                    value: IModelContainerMode.SINGLE_MODEL,
                                    label: 'Use a single model',
                                    description:
                                        'Use this to host a single model in this container.',
                                },
                                {
                                    value: IModelContainerMode.MULTI_MODEL,
                                    label: 'Use multiple models',
                                    description:
                                        'Use this to host multiple models in this container.',
                                },
                            ]}
                        />
                    </FormField>
                    <FormField
                        label='Location of inference code image'
                        description='Select the registry path where the inference code image is stored in Amazon ECR.'
                        errorText={errors?.Image}
                    >
                        <Autosuggest
                            value={state.Image || ''}
                            onChange={({ detail }) => setFields({ Image: detail.value })}
                            options={imageURIs.length > 0 ? imageURIs : []}
                            loadingText='Loading image URIs'
                            statusType={loadingImageOptions ? 'loading' : 'finished'}
                        />
                    </FormField>
                    <FormField
                        label={
                            <span>
                                Location of model artifacts{' '}
                                <Condition
                                    condition={state.Mode === IModelContainerMode.SINGLE_MODEL}
                                >
                                    {' '}
                                    <i>- optional</i>
                                </Condition>
                            </span>
                        }
                        description={
                            <>
                                Type the URL where model artifacts are stored in S3 or select a{' '}
                                <Link
                                    variant='primary'
                                    fontSize='body-s'
                                    onFollow={() => {
                                        dispatch(toggleSelectTrainingJobModal(true));
                                    }}
                                >
                                    training job
                                </Link>{' '}
                                to populate the artifact path.
                            </>
                        }
                        errorText={errors?.ModelDataUrl}
                    >
                        <Input
                            placeholder='s3://bucket/path-to-your-data/'
                            ariaLabel='Model artifacts S3 location'
                            value={state.ModelDataUrl || ''}
                            onChange={({ detail }) => setFields({ ModelDataUrl: detail.value })}
                        />
                    </FormField>
                    <FormField
                        label={
                            <span>
                                Container host name <i>- optional</i>
                            </span>
                        }
                        description='Type the DNS host name for the container.'
                        constraintText={generateNameConstraintText()}
                        errorText={errors?.ContainerHostName}
                    >
                        <Input
                            value={state.ContainerHostName!}
                            onChange={({ detail }) =>
                                setFields({ ContainerHostName: detail.value })
                            }
                            onBlur={() => touchFields(['ContainerHostName'])}
                        />
                    </FormField>
                </SpaceBetween>
            </ExpandableSection>
            <EnvironmentVariables
                item={state}
                setFields={setFields}
                touchFields={touchFields}
                formErrors={errors}
            />
            <Modal
                title='Training Job Artifact Path'
                visible={selectTrainingJobModalVisible}
                dismissText='Cancel'
                confirmText='Select training job'
                onDismiss={async () => {
                    await dispatch(toggleSelectTrainingJobModal(false));
                }}
                onConfirm={async () => {
                    if (selectedJob) {
                        const trainingJobResponse = await dispatch(
                            describeTrainingJob(selectedJob.resourceId)
                        );
                        const jobDetails = trainingJobResponse.payload;
                        setFields({
                            ModelDataUrl: jobDetails.ModelArtifacts?.S3ModelArtifacts,
                        });
                    }
                    await dispatch(toggleSelectTrainingJobModal(false));
                }}
            >
                <>
                    <p>
                        Select one of the training jobs from your project to populate the S3
                        artifact path with the training jobs output path.
                    </p>
                    <TrainingJobsTable
                        serverRequestProps={{ resourceStatus: JobStatus.Completed }}
                        variant='embedded'
                        header={<></>}
                        visibleColumns={['name', 'created']}
                        tableType='single'
                        selectItemsCallback={(jobs: TrainingJobResourceMetadata[]) => {
                            if (jobs.length === 1) {
                                setSelectedJob(jobs[0]);
                            }
                        }}
                    />
                </>
            </Modal>
        </Container>
    );
}

export default CreateModelContainer;
