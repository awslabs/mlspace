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

import { useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../config/store';
import React, { ReactNode, useEffect } from 'react';
import {
    ContentLayout,
    SpaceBetween,
    Header,
    Button,
    Link,
    Alert,
} from '@cloudscape-design/components';
import { DocTitle, scrollToPageHeader } from '../../../../src/shared/doc';
import { setBreadcrumbs } from '../../../shared/layout/navigation/navigation.reducer';
import DetailsContainer from '../../../modules/details-container';
import { formatDate } from '../../../shared/util/date-utils';
import { IBatchTranslate, TranslateJobStatus } from '../../../shared/model/translate.model';
import { prettyStatus } from '../../../shared/util/table-utils';
import {
    describeBatchTranslateJob,
    loadingBatchTranslateJob,
    selectedBatchTranslateJob,
    stopBatchTranslateJob,
} from '../batch-translate.reducer';
import NotificationService from '../../../shared/layout/notification/notification.service';
import { getBase } from '../../../shared/util/breadcrumb-utils';
import { getDownloadUrl } from '../../dataset/dataset.service';
import { useBackgroundRefresh } from '../../../shared/util/hooks';

function BatchTranslateDetail () {
    const { projectName, jobId } = useParams();
    const dispatch = useAppDispatch();
    const batchTranslateJob: IBatchTranslate = useAppSelector(selectedBatchTranslateJob);
    const jobLoading = useAppSelector(loadingBatchTranslateJob);
    const notificationService = NotificationService(dispatch);

    scrollToPageHeader();
    DocTitle('Batch Translate Job Details: ', jobId);

    useEffect(() => {
        if (jobId) {
            dispatch(describeBatchTranslateJob(jobId));

            dispatch(
                setBreadcrumbs([
                    getBase(projectName),
                    {
                        text: 'Batch Translate Jobs',
                        href: `#/project/${projectName}/batch-translate`,
                    },
                    {
                        text: `${batchTranslateJob.JobName}`,
                        href: `#/project/${projectName}/batch-translate/${jobId}`,
                    },
                ])
            );
        }
    }, [dispatch, projectName, jobId, batchTranslateJob.JobName]);

    // Refresh data in the background to keep state fresh
    const isBackgroundRefreshing = useBackgroundRefresh(() => {
        dispatch(describeBatchTranslateJob(jobId!));
    }, [dispatch], (batchTranslateJob?.JobStatus !== TranslateJobStatus.Failed && batchTranslateJob?.JobStatus !== TranslateJobStatus.Completed && batchTranslateJob?.JobStatus !== TranslateJobStatus.CompletedWithError));

    const batchJobSummary = new Map<string, ReactNode>();

    batchJobSummary.set(
        'Status',
        prettyStatus(batchTranslateJob.JobStatus, batchTranslateJob.Error?.ErrorMessage)
    );
    batchJobSummary.set('Encryption key', batchTranslateJob?.OutputDataConfig?.EncryptionKey?.Id);
    batchJobSummary.set(
        'Documents translated successfully',
        batchTranslateJob.JobDetails?.TranslatedDocumentsCount
    );

    batchJobSummary.set('Started', formatDate(batchTranslateJob?.SubmittedTime));
    batchJobSummary.set('IAM Role', batchTranslateJob.DataAccessRoleArn);
    batchJobSummary.set('Profanity masking', batchTranslateJob.Settings?.Profanity);

    batchJobSummary.set('Ended', formatDate(batchTranslateJob?.EndTime));
    batchJobSummary.set('Content type', batchTranslateJob?.InputDataConfig?.ContentType);
    batchJobSummary.set('Formality Setting', batchTranslateJob?.Settings?.Formality);

    batchJobSummary.set('Source Language Code', batchTranslateJob?.SourceLanguageCode);
    batchJobSummary.set('Input S3 URI', batchTranslateJob?.InputDataConfig?.S3Uri);
    batchJobSummary.set('Terminology Names', batchTranslateJob?.TerminologyNames);

    batchJobSummary.set('Target Language Codes', batchTranslateJob?.TargetLanguageCodes.join(', '));
    batchJobSummary.set('Output S3 URI', batchTranslateJob?.OutputDataConfig?.S3Uri);

    // Populate error fields only if the job failed/completedWithErrors and error data exists
    if (
        (batchTranslateJob?.JobStatus === TranslateJobStatus.Failed ||
            batchTranslateJob.JobStatus === TranslateJobStatus.CompletedWithError) &&
        batchTranslateJob?.Error
    ) {
        const s3LocationLink = (
            <Link
                variant='primary'
                fontSize='body-m'
                onFollow={async () => {
                    const downloadUrl = await getDownloadUrl(
                        batchTranslateJob.Error!.S3ErrorLocation!
                    );
                    window.open(downloadUrl, '_blank');
                }}
            >
                {batchTranslateJob.Error.S3ErrorLocation}
            </Link>
        );
        batchJobSummary.set('Error Details S3 Location', s3LocationLink);
    }

    const handleStop = async () => {
        const response = await dispatch(stopBatchTranslateJob(batchTranslateJob.JobId!));
        if (response) {
            const success = response.type.endsWith('/fulfilled');
            if (success) {
                notificationService.generateNotification('Successfully stopped job.', 'success');
            } else {
                notificationService.generateNotification('Failed to stop job.', 'error');
            }
        }
    };

    return (
        batchTranslateJob && (
            <ContentLayout header={<Header variant='h1'>{batchTranslateJob.JobName}</Header>}>
                <SpaceBetween size='xxl'>
                    <DetailsContainer
                        loading={jobLoading && !isBackgroundRefreshing}
                        columns={3}
                        header='Summary'
                        info={batchJobSummary}
                        alert={
                            batchTranslateJob.Error?.ErrorCode &&
                            batchTranslateJob.Error?.ErrorMessage ? (
                                    <Alert type='error' header='Failure reason'>
                                        {`${batchTranslateJob.Error.ErrorCode}: ${batchTranslateJob.Error.ErrorMessage}`}
                                    </Alert>
                                ) : undefined
                        }
                        actions={
                            <Button
                                disabled={
                                    batchTranslateJob.JobStatus !== TranslateJobStatus.InProgress &&
                                    batchTranslateJob.JobStatus !== TranslateJobStatus.Submitted
                                }
                                onClick={handleStop}
                            >
                                Stop
                            </Button>
                        }
                    />
                </SpaceBetween>
            </ContentLayout>
        )
    );
}

export default BatchTranslateDetail;
