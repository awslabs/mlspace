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

import { EndpointConfigComponentOptions } from '../common-components';
import Modal from '../../../modules/modal';
import { defaultColumns } from '../../../entities/model/model.columns';
import Table from '../../../modules/table';
import {
    defaultProductionVariant,
    IProductionVariant,
} from '../../../shared/model/endpoint-config.model';
import { toggleAddModelModal, toggleEditVariantModal } from '../endpoint-config.reducer';
import { useAppDispatch, useAppSelector } from '../../../config/store';
import { Form, FormField, Input } from '@cloudscape-design/components';
import Condition from '../../../modules/condition';
import React, { useState, useEffect } from 'react';
import { getProjectModels, clearModelsList } from '../../model/model.reducer';
import { setTableAnnouncement } from '../../../shared/util/table-utils';
import { ModelResourceMetadata } from '../../../shared/model/resource-metadata.model';
import { InstanceTypeSelector } from '../../../shared/metadata/instance-type-dropdown';

export const AddModelModal = ({
    endpointConfig,
    setEndpointConfig,
}: EndpointConfigComponentOptions): JSX.Element => {
    const dispatch = useAppDispatch();
    const showAddModelModal: boolean = useAppSelector(
        (state) => state.endpointConfig.showAddModelModal
    );
    const modelList: ModelResourceMetadata[] = useAppSelector((state) => state.model.modelsList);
    const loadingModels = useAppSelector((state) => state.model.loadingModelsList);
    const [selectedModel, setSelectedModel] = useState('');

    return (
        <Modal
            title='Add Model'
            visible={showAddModelModal}
            dismissText='Cancel'
            confirmText='Save'
            onDismiss={async () => {
                await dispatch(toggleAddModelModal(false));
            }}
            onConfirm={async () => {
                setEndpointConfig!({
                    ...endpointConfig,
                    ProductionVariants: [
                        ...(endpointConfig.ProductionVariants || []),
                        defaultProductionVariant(
                            selectedModel!,
                            (endpointConfig.ProductionVariants?.length || 0) + 1
                        ),
                    ],
                });
                await dispatch(toggleAddModelModal(false));
                setTableAnnouncement('Selected model added to table');
            }}
        >
            <Table
                tableName='Model'
                headerVariant='h3'
                tableType='single'
                trackBy='resourceId'
                selectItemsCallback={(models: ModelResourceMetadata[]) => {
                    if (models.length > 0) {
                        setSelectedModel(models[0].resourceId);
                    }
                }}
                allItems={modelList}
                itemNameProperty='resourceId'
                columnDefinitions={defaultColumns}
                visibleColumns={['modelName', 'creationTime']}
                variant='embedded'
                loadingItems={loadingModels}
                serverFetch={getProjectModels}
                storeClear={clearModelsList}
            />
        </Modal>
    );
};

export const EditVariantModal = ({
    endpointConfig,
    isServerless,
    setEndpointConfig,
}: EndpointConfigComponentOptions): JSX.Element => {
    const dispatch = useAppDispatch();
    const currentVariant = useAppSelector((state) => state.endpointConfig.selectedVariant);
    const [selectedVariant, setSelectedVariant] = useState(currentVariant as IProductionVariant);
    const showEditVariantModal: boolean = useAppSelector(
        (state) => state.endpointConfig.showEditVariantModal
    );
    const [variantIndex, setVariantIndex] = useState(-1);

    useEffect(() => {
        setSelectedVariant(currentVariant);

        // we need to grab the ProductionVariant index because the variantName can be changed
        // and ModelName is not unique
        setVariantIndex(
            endpointConfig.ProductionVariants!.findIndex(
                (v) => v.VariantName === currentVariant.VariantName
            )
        );

        // Disable exhaustive-deps rule to skip having to add endpointConfig.ProductionVariants
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentVariant]);

    return (
        <Modal
            title='Edit Production Variant'
            visible={showEditVariantModal}
            dismissText='Cancel'
            confirmText='Save'
            onDismiss={async () => {
                await dispatch(toggleEditVariantModal(false));
            }}
            onConfirm={async () => {
                // Update all fields on the selected variant...
                const existingVariants = JSON.parse(
                    JSON.stringify(endpointConfig.ProductionVariants)
                );
                existingVariants.splice(variantIndex!, 1, selectedVariant);
                setEndpointConfig!({
                    ...endpointConfig,
                    ProductionVariants: existingVariants,
                });

                await dispatch(toggleEditVariantModal(false));
            }}
        >
            <Form>
                <FormField label='Model name'>
                    <Input disabled={true} value={selectedVariant.ModelName} />
                </FormField>
                <FormField label='Variant name'>
                    <Input
                        value={selectedVariant.VariantName}
                        onChange={({ detail }) => {
                            setSelectedVariant({
                                ...selectedVariant,
                                VariantName: detail.value,
                            });
                        }}
                    />
                </FormField>
                <Condition condition={!isServerless}>
                    <FormField label='Instance type'>
                        <InstanceTypeSelector
                            selectedOption={
                                selectedVariant.InstanceType
                                    ? {
                                        label: selectedVariant.InstanceType,
                                        value: selectedVariant.InstanceType,
                                    }
                                    : null
                            }
                            onChange={({ detail }) => {
                                setSelectedVariant({
                                    ...selectedVariant,
                                    InstanceType: detail.selectedOption.value,
                                });
                            }}
                            instanceTypeCategory='ProductionVariantInstanceType'
                            service='endpoint'
                        />
                    </FormField>
                    <FormField label='Elastic inference'>
                        <Input
                            value={selectedVariant.AcceleratorType || ''}
                            onChange={({ detail }) => {
                                setSelectedVariant({
                                    ...selectedVariant,
                                    AcceleratorType: detail.value,
                                });
                            }}
                        />
                    </FormField>
                    <FormField label='Initial instance count'>
                        <Input
                            value={selectedVariant.InitialInstanceCount?.toString() || ''}
                            onChange={({ detail }) => {
                                setSelectedVariant({
                                    ...selectedVariant,
                                    InitialInstanceCount: +detail.value,
                                });
                            }}
                        />
                    </FormField>
                    <FormField label='Initial weight'>
                        <Input
                            value={selectedVariant.InitialVariantWeight?.toString() || ''}
                            onChange={({ detail }) => {
                                setSelectedVariant({
                                    ...selectedVariant,
                                    InitialVariantWeight: +detail.value,
                                });
                            }}
                        />
                    </FormField>
                </Condition>
            </Form>
        </Modal>
    );
};
