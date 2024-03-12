/* eslint-disable */
import React from 'react';
import {
    Checkbox,
    Container,
    FormField,
    Header,
    Input,
    SpaceBetween,
} from '@cloudscape-design/components';
import { FormProps } from '../../form-props';
import Condition from '../../../../modules/condition';
import { ILabelingJobCreateForm } from './labeling-job-create';
import { ModifyMethod } from '../../../../shared/validation/modify-method';

export type LabelingJobOverviewProps = FormProps<ILabelingJobCreateForm>;

export function LabelingJobOverview(props: LabelingJobOverviewProps) {
    const { item, setFields, touchFields, formErrors } = props;

    return (
        <Container header={<Header>Job overview</Header>}>
            <SpaceBetween direction="vertical" size="m">
                <FormField
                    label="Job name"
                    constraintText={`The name must be from 1 to 63 characters and must be unique in your AWS account and AWS Region. Valid characters are a-z, A-Z, 0-9, and hyphen (-).`}
                    errorText={formErrors?.job?.LabelingJobName}
                >
                    <Input
                        value={item.job.LabelingJobName}
                        onChange={({ detail }) => {
                            setFields({ 'job.LabelingJobName': detail.value });
                        }}
                        onBlur={() => touchFields(['job.LabelingJobName'])}
                        data-cy="name-input"
                    />
                </FormField>

                <Checkbox
                    checked={item.specifyAttribute}
                    onChange={({ detail }) => {
                        setFields({
                            specifyAttribute: detail.checked,
                            'job.LabelAttributeName': '',
                        });

                        if (!detail.checked) {
                            setFields(
                                {
                                    'job.LabelAttributeName': false,
                                },
                                ModifyMethod.Unset
                            );
                            touchFields(['job.LabelAttributeName'], ModifyMethod.Unset);
                        }
                    }}
                >
                    I want to specify a label attribute name different from the labeling job name.
                </Checkbox>

                <Condition condition={item.specifyAttribute}>
                    <FormField
                        label="Label attribute name"
                        constraintText={`Maximum of 63 alphanumeric characters. Can include hyphens (-), but not spaces or reserved suffixes "-ref" and "-metadata".`}
                        errorText={formErrors?.job?.LabelAttributeName}
                    >
                        <Input
                            value={`${item.job?.LabelAttributeName}`}
                            onChange={(event) => {
                                setFields({ 'job.LabelAttributeName': event.detail.value });
                            }}
                            onBlur={() => touchFields(['job.LabelAttributeName'])}
                        />
                    </FormField>
                </Condition>
                <FormField
                    label="S3 location for input datasets"
                    description="Provide a path to the S3 location where your manifest file is stored."
                    errorText={
                        formErrors?.job?.InputConfig?.DataSource?.S3DataSource?.ManifestS3Uri
                    }
                >
                    <Input
                        value={`${item.job.InputConfig.DataSource.S3DataSource.ManifestS3Uri}`}
                        onChange={(event) => {
                            setFields({
                                'job.InputConfig.DataSource.S3DataSource.ManifestS3Uri':
                                    event.detail.value,
                            });
                        }}
                        onBlur={() =>
                            touchFields(['job.InputConfig.DataSource.S3DataSource.ManifestS3Uri'])
                        }
                        data-cy="manifest-file-input"
                    />
                </FormField>
                <FormField
                    label="Output dataset location"
                    description="Provide a path to the S3 location where you want your labeled dataset to be stored."
                    errorText={formErrors?.job?.OutputConfig?.S3OutputPath}
                >
                    <Input
                        value={`${item.job.OutputConfig.S3OutputPath}`}
                        onChange={(event) => {
                            setFields({ 'job.OutputConfig.S3OutputPath': event.detail.value });
                        }}
                        onBlur={() => touchFields(['job.OutputConfig.S3OutputPath'])}
                        data-cy="output-location-input"
                    />
                </FormField>
            </SpaceBetween>
        </Container>
    );
}

export default LabelingJobOverview;
