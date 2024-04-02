import React from 'react';
import { FormProps } from '../../form-props';
import { ILabelingJobCreateForm } from './labeling-job-create';
import {
    Button,
    Container,
    ExpandableSection,
    FormField,
    Grid,
    Header,
    Input,
    SpaceBetween,
    Textarea,
} from '@cloudscape-design/components';

import { ModifyMethod } from '../../../../shared/validation/modify-method';
import { TASK_TYPE_CONFIG } from './labeling-job-task-config';
import { RichTextEditor } from '../../../../shared/util/rich-text-utils';

export type LabelingJobTemplateConfigurationProps = FormProps<ILabelingJobCreateForm>;

export function LabelingJobTemplateConfiguration (props: LabelingJobTemplateConfigurationProps) {
    const { item, setFields, formErrors, touchFields } = props;
    const taskConfig = TASK_TYPE_CONFIG[item.taskCategory][item.taskSelection];

    return (
        <Container
            header={
                <Header description='Provide instructions to help workers identify correct and incorrect labels. Workers will refer to these instructions for each task to verify existing labels. You can add up to 30 labels for workers to choose from.'>
                    Label verification tool
                </Header>
            }
        >
            <SpaceBetween direction='vertical' size='m'>
                <Grid
                    gridDefinition={[
                        { colspan: { default: 12, xs: 5 } },
                        { colspan: { default: 12, xs: 7 } },
                    ]}
                >
                    <RichTextEditor
                        value={item.shortInstruction}
                        onChange={(event) => {
                            setFields({
                                shortInstruction: event,
                            });
                        }}
                        id='editor-1'
                    />
                    <SpaceBetween direction='vertical' size='m'>
                        <FormField
                            label='Enter a brief description of the task'
                            stretch={true}
                            errorText={formErrors?.description}
                        >
                            <Textarea
                                value={item.description}
                                onChange={({ detail }) => {
                                    const newTaskConfig =
                                        TASK_TYPE_CONFIG[item.taskCategory][item.taskSelection];

                                    setFields({
                                        description: detail.value,
                                        'job.HumanTaskConfig.TaskTitle': `${newTaskConfig?.label}: ${detail.value}`,
                                    });
                                }}
                                placeholder='Enter a brief description of the task'
                                data-cy='description-textarea'
                            />
                        </FormField>
                        <SpaceBetween direction='vertical' size='m'>
                            <Header
                                variant='h3'
                                description={`Add up to ${taskConfig.maxLabelCount} labels`}
                            >
                                Labels
                            </Header>

                            {item.labels.map((label, index) => {
                                return (
                                    <FormField
                                        key={index}
                                        label='Data Label'
                                        errorText={formErrors?.labels?.[index]?.label}
                                        secondaryControl={
                                            <Button
                                                onClick={() => {
                                                    const labels = [...item.labels];
                                                    labels.splice(index, 1);
                                                    setFields({ labels });
                                                    touchFields(
                                                        [`labels[${index}]`],
                                                        ModifyMethod.Unset
                                                    );
                                                }}
                                                disabled={
                                                    item.labels.length <= taskConfig.minLabelCount
                                                }
                                            >
                                                Remove
                                            </Button>
                                        }
                                    >
                                        <Input
                                            value={label.label}
                                            onChange={({ detail }) => {
                                                const mergeFields = {} as any;
                                                mergeFields[`labels[${index}].label`] =
                                                    detail.value;
                                                setFields(mergeFields);
                                            }}
                                            onBlur={() => {
                                                touchFields([`labels[${index}].label`]);
                                            }}
                                            data-cy={`label-${index}`}
                                        />
                                    </FormField>
                                );
                            })}
                            <FormField
                                constraintText={`You can add up to ${
                                    taskConfig.maxLabelCount - item.labels.length
                                } more labels`}
                            >
                                <Button
                                    onClick={() => {
                                        setFields(
                                            {
                                                labels: [...item.labels, { label: '' }],
                                            },
                                            ModifyMethod.Set
                                        );
                                    }}
                                    disabled={item.labels.length >= taskConfig.maxLabelCount}
                                >
                                    Add new label
                                </Button>
                            </FormField>
                        </SpaceBetween>
                    </SpaceBetween>
                </Grid>
                <ExpandableSection
                    headerText={
                        <span>
                            Additional instructions - <em>optional</em>
                        </span>
                    }
                >
                    <RichTextEditor
                        value={item.fullInstruction}
                        onChange={(event) => {
                            setFields({
                                fullInstruction: event,
                            });
                        }}
                        id='editor-2'
                    />
                </ExpandableSection>
            </SpaceBetween>
        </Container>
    );
}

export default LabelingJobTemplateConfiguration;
