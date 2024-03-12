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
    Box,
    Button,
    ColumnLayout,
    Header,
    SpaceBetween,
    TableProps,
} from '@cloudscape-design/components';
import { useAppDispatch, useAppSelector } from '../../config/store';
import Table from '../../modules/table';
import {
    ICaptureOption,
    IDataCaptureConfig,
    IEndpointConfig,
} from '../../shared/model/endpoint-config.model';
import { productionVariantColumns } from './endpoint-config.columns';
import { toggleAddModelModal } from './endpoint-config.reducer';
import { loadingModelsList } from '../model/model.reducer';
import React, { ReactNode } from 'react';
import DetailsContainer from '../../modules/details-container';
import { ConditionalWrapper } from '../../modules/condition/condition';
import { IEndpointDataCaptureConfig } from '../../shared/model/endpoint.model';
import { formatDate } from '../../shared/util/date-utils';

export type EmbeddedableComponent = {
    isEmbedded?: boolean;
};

export type EndpointConfigComponentOptions = {
    endpointConfig: IEndpointConfig;
    projectName?: string;
    canEdit?: boolean;
    isServerless?: boolean;
    variant?: 'default' | 'embedded' | 'minimal';
    tableItemAction?(action: string, key: string): any;
    setEndpointConfig?(value: React.SetStateAction<IEndpointConfig>): any;
};

type DataCaptureComponentOptions = {
    dataCaptureConfig?: IDataCaptureConfig;
    endpointCaptureConfig?: IEndpointDataCaptureConfig;
} & EmbeddedableComponent;

export const ProductionVariantsTable = ({
    endpointConfig,
    canEdit,
    tableItemAction,
    variant = 'default',
}: EndpointConfigComponentOptions): JSX.Element => {
    const dispatch = useAppDispatch();

    const columns = productionVariantColumns({
        canEdit,
        tableItemAction,
    });

    let tableVariant: TableProps.Variant = 'container';
    switch (variant) {
        case 'minimal':
            tableVariant = 'embedded';
            break;
        case 'embedded':
            tableVariant = 'stacked';
            break;
    }

    const loadingModels = useAppSelector(loadingModelsList);

    return (
        <Table
            tableName='Production variant'
            columnDefinitions={columns}
            visibleColumns={columns.map((c) => c.id!)}
            trackBy='VariantName'
            allItems={endpointConfig?.ProductionVariants || []}
            showCounter={false}
            showFilter={false}
            showPreference={false}
            showPaging={false}
            variant={tableVariant}
            header={
                <Header variant={variant !== 'default' ? 'h3' : 'h2'}>Production variants</Header>
            }
            empty={
                <Box textAlign='center' color='inherit'>
                    <Box padding={{ bottom: 's' }} variant='p' color='inherit'>
                        There are currently no resources.
                    </Box>
                </Box>
            }
            footer={
                !canEdit ? undefined : (
                    <Box fontWeight='bold' textAlign='left' color='inherit'>
                        <Button variant='link' onClick={() => dispatch(toggleAddModelModal(true))}>
                            Add model
                        </Button>
                    </Box>
                )
            }
            loadingItems={loadingModels}
            loadingText='Loading resources'
        />
    );
};

export const DataCaptureSettings = ({
    dataCaptureConfig,
    endpointCaptureConfig,
    isEmbedded,
}: DataCaptureComponentOptions) => {
    const captureSettings = new Map<string, ReactNode>();
    if (dataCaptureConfig) {
        captureSettings.set('Enable data capture', dataCaptureConfig.EnableCapture ? 'Yes' : 'No');
        let captureOptions = '';
        if (
            dataCaptureConfig.CaptureOptions?.find(
                (option: ICaptureOption) => option.CaptureMode === 'Input'
            ) !== undefined
        ) {
            captureOptions = 'Prediction request <br />';
        }
        if (
            dataCaptureConfig.CaptureOptions?.find(
                (option: ICaptureOption) => option.CaptureMode === 'Output'
            ) !== undefined
        ) {
            captureOptions = 'Prediction response';
        }
        captureSettings.set('Data capture options', captureOptions);
        captureSettings.set(
            'S3 location to store data collected',
            dataCaptureConfig.DestinationS3Uri
        );
        captureSettings.set(
            'Capture content type',
            <div>
                <div>
                    CSV/Text <br />
                    {dataCaptureConfig.CaptureContentTypeHeader?.CsvContentTypes?.join(', ') || '-'}
                </div>
                <div>
                    JSON <br />
                    {dataCaptureConfig.CaptureContentTypeHeader?.JsonContentTypes?.join(', ') ||
                        '-'}
                </div>
            </div>
        );
        captureSettings.set('Sampling percentage (%)', dataCaptureConfig.InitialSamplingPercentage);
    } else if (endpointCaptureConfig) {
        captureSettings.set(
            'Enable data capture',
            endpointCaptureConfig.EnableCapture ? 'Yes' : 'No'
        );
        captureSettings.set('Data capture status', endpointCaptureConfig.CaptureStatus);
        captureSettings.set(
            'Current sampling percentage (%)',
            endpointCaptureConfig.CurrentSamplingPercentage
        );
        captureSettings.set(
            'S3 location to store data collected',
            endpointCaptureConfig.DestinationS3Uri
        );
    }

    return (
        <DetailsContainer
            columns={4}
            header={dataCaptureConfig ? 'Data capture' : 'Data capture settings'}
            info={captureSettings}
            isEmbedded={isEmbedded}
        />
    );
};

export const EndpointConfigDetailsView = ({
    endpointConfig,
    projectName,
    variant = 'default',
}: EndpointConfigComponentOptions): JSX.Element => {
    const configSettings = new Map<string, string>();
    configSettings.set('Name', endpointConfig.EndpointConfigName!);
    configSettings.set('ARN', endpointConfig.EndpointConfigArn!);
    configSettings.set('Encryption key', endpointConfig.KmsKeyId || '-');
    configSettings.set('Creation time', formatDate(endpointConfig.CreationTime!));
    const embeddedWrapper = (condition: boolean, children: any) => {
        if (condition) {
            return <div>{children}</div>;
        }
        return <SpaceBetween size='l'>{children}</SpaceBetween>;
    };
    const isEmbedded = variant === 'embedded';
    return (
        <ConditionalWrapper condition={isEmbedded} wrapper={embeddedWrapper}>
            {variant !== 'minimal' ? (
                <>
                    <DetailsContainer
                        columns={4}
                        header={
                            isEmbedded
                                ? 'Endpoint configuration'
                                : 'Endpoint configuration settings'
                        }
                        info={configSettings}
                        isEmbedded={isEmbedded}
                    />
                    <DataCaptureSettings
                        dataCaptureConfig={endpointConfig.DataCaptureConfig || {}}
                        isEmbedded={isEmbedded}
                    />
                </>
            ) : (
                <ColumnLayout columns={2}>
                    <div>
                        <Box variant='awsui-key-label'>Endpoint configuration name</Box>
                        {endpointConfig.EndpointConfigName}
                    </div>
                    <div>
                        <Box variant='awsui-key-label'>Encryption key</Box>
                        {endpointConfig.KmsKeyId || '-'}
                    </div>
                </ColumnLayout>
            )}
            <ProductionVariantsTable
                endpointConfig={endpointConfig}
                projectName={projectName}
                canEdit={false}
                variant={variant}
            />
        </ConditionalWrapper>
    );
};
