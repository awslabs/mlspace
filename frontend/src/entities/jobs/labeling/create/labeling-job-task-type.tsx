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

import React from 'react';
import {
    Container,
    FormField,
    Header,
    Select,
    SpaceBetween,
    Tiles,
} from '@cloudscape-design/components';
import { FormProps } from '../../form-props';
import { ILabelingJobCreateForm } from './labeling-job-create';
import { TASK_TYPE_CONFIG } from './labeling-job-task-config';
import { ModifyMethod } from '../../../../shared/validation/modify-method';
import { LabelingJobCategory } from '../labeling-job.model';
import { LabelingJobTypes } from '../labeling-job.common';
import { initCap } from '../../../../shared/util/enum-utils';

export type LabelingJobTaskTypeProps = FormProps<ILabelingJobCreateForm>;

export function LabelingJobTaskType (props: LabelingJobTaskTypeProps) {
    const { item, setFields, touchFields, formErrors } = props;

    const commonTaskFields = (newTaskConfig: any, description: any) => {
        return {
            shortInstruction: newTaskConfig.shortInstruction,
            fullInstruction: newTaskConfig.fullInstruction,
            description: '',
            labels: Array(newTaskConfig?.minLabelCount || 1)
                .fill(0)
                .map(() => ({ label: '' })),
            'job.HumanTaskConfig.TaskTitle': `${newTaskConfig?.label}: `,
            'job.HumanTaskConfig.TaskDescription': initCap(description),
            'job.HumanTaskConfig.TaskKeywords': newTaskConfig?.keywords,
        };
    };

    return (
        <Container header={<Header>Task type</Header>}>
            <SpaceBetween direction='vertical' size='m'>
                <FormField
                    label='Task category'
                    description={
                        'Select the type of data being labeled to view available task templates for it.'
                    }
                    errorText={formErrors?.job?.taskCategory}
                >
                    <Select
                        selectedOption={{ label: item.taskCategory, value: item.taskCategory }}
                        options={[
                            {
                                label: LabelingJobCategory.Image,
                                value: LabelingJobCategory.Image,
                            },
                            {
                                label: LabelingJobCategory.Text,
                                value: LabelingJobCategory.Text,
                            },
                        ]}
                        onChange={({ detail }) => {
                            let taskSelection = LabelingJobTypes.ImageMultiClass;
                            if (detail.selectedOption.value === LabelingJobCategory.Text) {
                                taskSelection = LabelingJobTypes.TextMultiClass;
                            }

                            const newTaskConfig =
                                TASK_TYPE_CONFIG[
                                    detail.selectedOption.value || LabelingJobCategory.Image
                                ][taskSelection];
                            const description = newTaskConfig?.description.replace(
                                /^Get workers to /,
                                ''
                            );

                            touchFields(['labels'], ModifyMethod.Unset);
                            setFields({
                                taskCategory: detail.selectedOption.value,
                                taskSelection,
                                ...commonTaskFields(newTaskConfig, description),
                            });
                        }}
                        onBlur={() => touchFields(['taskCategory'])}
                        data-cy='task-category-select'
                    />
                </FormField>

                <FormField
                    label='Task selection'
                    description='Select the task that a human worker will perform to label objects in your dataset.'
                >
                    <Tiles
                        value={item.taskSelection}
                        items={Object.values(TASK_TYPE_CONFIG[item.taskCategory]).filter(
                            (t) => t.enabled
                        )}
                        onChange={({ detail }) => {
                            const newTaskConfig = TASK_TYPE_CONFIG[item.taskCategory][detail.value];
                            const description = newTaskConfig?.description.replace(
                                /^Get workers to /,
                                ''
                            );
                            touchFields(['labels'], ModifyMethod.Unset);
                            setFields({
                                taskSelection: newTaskConfig.value,
                                ...commonTaskFields(newTaskConfig, description),
                            });
                        }}
                        data-cy='task-selection-tiles'
                    />
                </FormField>
            </SpaceBetween>
        </Container>
    );
}

export default LabelingJobTaskType;
