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

import { FormProps } from '../../form-props';
import { ILabelingJobCreateForm } from './labeling-job-create';
import {
    Container,
    FormField,
    Header,
    Input,
    SpaceBetween,
    Textarea
} from '@cloudscape-design/components';
import LabelingJobWorkers from './labeling-job-workers';

export type LabelingJobCustomProps = FormProps<ILabelingJobCreateForm>;

export function LabelingJobCustom (props: LabelingJobCustomProps) {
    const { item, formErrors, setFields, touchFields } = props;

    return (
        <SpaceBetween direction='vertical' size='l'>
            <LabelingJobWorkers {...props} />
            <Container header={<Header>Custom labeling task setup</Header>}>
                <SpaceBetween direction='vertical' size='m'>
                    <FormField
                        label='Task title'
                        description='Give your task a short title to display in the task queue page.'
                        constraintText={'Maximum of 128 characters.'}
                        errorText={formErrors?.job?.HumanTaskConfig.TaskTitle}
                    >
                        <Input
                            value={item.job.HumanTaskConfig.TaskTitle || ''}
                            placeholder='Enter a title for your custom task'
                            onChange={(event) => {
                                setFields({
                                    'job.HumanTaskConfig.TaskTitle': event.detail.value,
                                    labels: [{ label: 'custom-label-job-dummy-label-1' }, {label: 'custom-label-job-dummy-label-2'}]
                                });
                            }}
                            onBlur={() => touchFields(['job.HumanTaskConfig.TaskTitle'])}
                            data-cy='job.HumanTaskConfig.TaskTitle'
                        />
                    </FormField>
                    <FormField
                        label='Task description'
                        description='Enter a brief description of your task.'
                        constraintText={'Maximum of 255 characters.'}
                        errorText={formErrors?.job?.HumanTaskConfig.TaskDescription}
                    >
                        <Input
                            value={item.job.HumanTaskConfig.TaskDescription || ''}
                            placeholder='Enter a description for your custom task'
                            onChange={(event) => {
                                setFields({
                                    'job.HumanTaskConfig.TaskDescription': event.detail.value,
                                    description: event.detail.value,
                                    labels: [{ label: 'custom-label-job-dummy-label-1' }, {label: 'custom-label-job-dummy-label-2'}]
                                });
                            }}
                            onBlur={() => touchFields(['job.HumanTaskConfig.TaskDescription'])}
                            data-cy='job.HumanTaskConfig.TaskDescription'
                        />
                    </FormField>
                    <FormField
                        label='Template'
                        description='Enter your custom template .html code'
                        errorText={formErrors?.custom_task_template}
                    >
                        <Textarea
                            value={item.custom_task_template || ''}
                            onChange={(event) => {
                                setFields({ custom_task_template: event.detail.value, labels: [{ label: 'custom-label-job-dummy-label-1' }, {label: 'custom-label-job-dummy-label-2'}]});
                            }}
                            onBlur={() => touchFields(['custom_task_template'])}
                            rows={15}
                            data-cy='custom_task_template'
                        />
                    </FormField>
                </SpaceBetween>
            </Container>
        </SpaceBetween>
    );
}

export default LabelingJobCustom;