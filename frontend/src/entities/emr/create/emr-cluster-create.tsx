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

import React, { useEffect } from 'react';
import {
    Button,
    Container,
    ContentLayout,
    ExpandableSection,
    Form,
    FormField,
    Grid,
    Header,
    Input,
    RadioGroup,
    Select,
    SpaceBetween,
} from '@cloudscape-design/components';
import { useNavigate, useParams } from 'react-router-dom';
import z from 'zod';
import { useAppDispatch } from '../../../config/store';
import NotificationService from '../../../shared/layout/notification/notification.service';
import { issuesToErrors, scrollToInvalid, useValidationReducer } from '../../../shared/validation';
import { createEMRCluster } from '../emr.reducer';
import { setBreadcrumbs } from '../../../../src/shared/layout/navigation/navigation.reducer';
import { getBase } from '../../../../src/shared/util/breadcrumb-utils';
import { scrollToPageHeader } from '../../../../src/shared/doc';
import { generateNameConstraintTextWithProject } from '../../../shared/util/form-utils';
import { useState } from 'react';
import { enumToOptions } from '../../../shared/util/enum-utils';
import Condition from '../../../modules/condition';

enum ClusterAmi {
    BUILT_IN = 'built-in',
    CUSTOM = 'custom',
}

export default function EMRClusterCreate () {
    const navigate = useNavigate();
    const { projectName } = useParams();
    const basePath = `/project/${projectName}/emr`;
    const dispatch = useAppDispatch();
    const notificationService = NotificationService(dispatch);
    const [clusterAmi, setClusterAmi] = useState(ClusterAmi.BUILT_IN);

    const formSchema = z.object({
        clusterName: z
            .string()
            .min(3)
            .max(63 - projectName!.length)
            .regex(/^[a-zA-Z0-9-]*$/, {
                message: 'Name can only contain alphanumeric characters and hyphens (-)',
            }),
        options: z.object({
            customAmiId: z
                .string()
                .nullable()
                .superRefine((value, ctx) => {
                    if (clusterAmi === ClusterAmi.CUSTOM && !value) {
                        ctx.addIssue({
                            code: 'custom',
                            message: 'Custom AMI Id is required.',
                        });
                    }
                }),
            emrSize: z.string(),
            emrRelease: z.string(),
        }),
    });

    const { state, setState, setFields, touchFields } = useValidationReducer(formSchema, {
        validateAll: false as boolean,
        touched: {},
        formSubmitting: false as boolean,
        form: {
            clusterName: '',
            options: {
                customAmiId: '',
                emrSize: 'Small',
                emrRelease: 'emr-6.2.0',
            },
        },
    });

    let formErrors = {} as any;
    const parseResult = formSchema.safeParse(state.form);
    if (!parseResult.success) {
        formErrors = issuesToErrors(
            parseResult.error.issues,
            state.validateAll === true ? undefined : state.touched
        );
    }

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                { text: 'EMR Clusters', href: `#${basePath}` },
                { text: 'Create EMR Cluster', href: `#${basePath}/create` },
            ])
        );

        scrollToPageHeader('h1', 'Create EMR Cluster');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, basePath, projectName]);

    const handleSubmit = () => {
        setState({ formSubmitting: true });

        const parseResult = formSchema.safeParse(state.form);
        if (parseResult.success) {
            notificationService.generateNotification(
                `Creating ${state.form.clusterName}. Please wait.`,
                'info'
            );

            dispatch(
                createEMRCluster({ projectName: projectName!, environment_options: state.form })
            ).then((response) => {
                if (response.type.endsWith('/fulfilled')) {
                    notificationService.generateNotification(
                        `Successfully created EMR Cluster ${state.form.clusterName}.`,
                        'success'
                    );
                    // Path is dependent on the lambda response of emr/lambda_function for the EMR name
                    navigate(
                        `${basePath}/${response.payload.JobFlowId}/${projectName}-${state.form.clusterName}`
                    );
                } else {
                    notificationService.generateNotification(
                        `Failed to create cluster: ${response.payload}`,
                        'error'
                    );
                    setState({ formSubmitting: false });
                }
            });
        } else {
            scrollToInvalid();
            formErrors = issuesToErrors(parseResult.error.issues, undefined);
            setState({ validateAll: true, formSubmitting: false });
        }
    };

    return (
        <ContentLayout header={<Header variant='h1'>Create EMR Cluster</Header>}>
            <Form
                actions={
                    <SpaceBetween direction='horizontal' size='xl'>
                        <Button
                            formAction='none'
                            variant='link'
                            onClick={() =>
                                navigate(basePath, {
                                    state: { prevPath: window.location.hash },
                                })
                            }
                        >
                            Cancel
                        </Button>
                        <Button
                            loading={state.formSubmitting}
                            variant='primary'
                            onClick={() => {
                                handleSubmit();
                            }}
                            disabled={state.formSubmitting}
                        >
                            Create
                        </Button>
                    </SpaceBetween>
                }
            >
                <SpaceBetween direction='vertical' size='xxl'>
                    <Container header={<h2>Cluster settings</h2>}>
                        <Grid disableGutters gridDefinition={[{ colspan: 3 }, { colspan: 9 }]}>
                            <FormField label='Project name'>
                                <Input value={`${projectName}-`} disabled />
                            </FormField>
                            <FormField
                                label='Cluster name'
                                constraintText={generateNameConstraintTextWithProject(projectName!)}
                                errorText={formErrors.clusterName}
                            >
                                <Input
                                    value={state.form.clusterName}
                                    onChange={(event) =>
                                        setFields({ clusterName: event.detail.value })
                                    }
                                    disabled={state.formSubmitting}
                                    onBlur={() => touchFields(['clusterName'])}
                                />
                            </FormField>
                        </Grid>
                    </Container>

                    <Container header={<h2>Resources</h2>}>
                        <SpaceBetween direction='vertical' size='l'>
                            <FormField label='Cluster Size' errorText={formErrors.options?.emrSize}>
                                <Select
                                    selectedOption={{
                                        value: state.form.options.emrSize,
                                    }}
                                    options={[
                                        { value: 'Small' },
                                        { value: 'Medium' },
                                        { value: 'Large' },
                                    ]}
                                    onChange={({ detail }) =>
                                        setFields({
                                            'options.emrSize': detail.selectedOption.value,
                                        })
                                    }
                                />
                            </FormField>

                            <FormField
                                label='EMR Version'
                                errorText={formErrors.options?.emrRelease}
                            >
                                <Select
                                    selectedOption={{
                                        value: state.form.options.emrRelease,
                                    }}
                                    onChange={({ detail }) => {
                                        setFields({
                                            'options.emrRelease': detail.selectedOption.value,
                                        });
                                    }}
                                    options={[
                                        { value: 'emr-6.6.0' },
                                        { value: 'emr-6.3.0' },
                                        { value: 'emr-6.2.0' },
                                    ]}
                                />
                            </FormField>
                            <ExpandableSection
                                headerText='Advanced configuration'
                                headingTagOverride='h3'
                            >
                                <SpaceBetween direction='vertical' size='l'>
                                    <FormField
                                        label='Operating system options'
                                        description='When you create and launch a cluster, Amazon EMR uses an Amazon Linux Amazon Machine Image (AMI) to initialize Amazon EC2 instances. Alternatively, you can choose to specify a different Amazon Linux release for your cluster.'
                                    >
                                        <RadioGroup
                                            value={clusterAmi}
                                            items={enumToOptions(ClusterAmi, true)}
                                            onChange={(event) => {
                                                setClusterAmi(event.detail.value as ClusterAmi);
                                                if (event.detail.value === ClusterAmi.BUILT_IN) {
                                                    setFields({ 'options.customAmiId': '' });
                                                }
                                            }}
                                        />
                                    </FormField>
                                    <Condition condition={clusterAmi === ClusterAmi.CUSTOM}>
                                        <FormField
                                            label='Custom AMI Id'
                                            errorText={formErrors.options?.customAmiId}
                                        >
                                            <Input
                                                value={`${state.form.options.customAmiId}`}
                                                onChange={(event) =>
                                                    setFields({
                                                        'options.customAmiId': event.detail.value,
                                                    })
                                                }
                                                disabled={
                                                    state.formSubmitting ||
                                                    clusterAmi === ClusterAmi.BUILT_IN
                                                }
                                            />
                                        </FormField>
                                    </Condition>
                                </SpaceBetween>
                            </ExpandableSection>
                        </SpaceBetween>
                    </Container>
                </SpaceBetween>
            </Form>
        </ContentLayout>
    );
}
