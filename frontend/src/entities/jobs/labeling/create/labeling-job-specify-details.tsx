import { SpaceBetween } from '@cloudscape-design/components';
import React from 'react';
import LabelingJobOverview from './labeling-job-overview';
import LabelingJobTaskType from './labeling-job-task-type';
import { FormProps } from '../../form-props';
import { ILabelingJobCreateForm } from './labeling-job-create';

export type LabelingJobSpecifyDetailsProps = FormProps<ILabelingJobCreateForm>;

export function LabelingJobSpecifyDetails (props: LabelingJobSpecifyDetailsProps) {
    return (
        <SpaceBetween direction='vertical' size='l'>
            <LabelingJobOverview {...props} />
            <LabelingJobTaskType {...props} />
        </SpaceBetween>
    );
}

export default LabelingJobSpecifyDetails;
