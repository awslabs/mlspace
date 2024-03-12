import { SpaceBetween } from '@cloudscape-design/components';
import React from 'react';
import { FormProps } from '../../form-props';
import { ILabelingJobCreateForm } from './labeling-job-create';
import LabelingJobWorkers from './labeling-job-workers';
import LabelingJobTemplateConfiguration from './labeling-job-template-configuration';

export type LabelingJobSelectWorkersProps = FormProps<ILabelingJobCreateForm>;

export function LabelingJobSelectWorkers (props: LabelingJobSelectWorkersProps) {
    return (
        <SpaceBetween direction='vertical' size='l'>
            <LabelingJobWorkers {...props} />
            <LabelingJobTemplateConfiguration {...props} />
        </SpaceBetween>
    );
}

export default LabelingJobSelectWorkers;
