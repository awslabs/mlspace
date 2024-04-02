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
import React, { Dispatch, useEffect } from 'react';
import { Button, FormField, Grid, Input, Select, SpaceBetween} from '@cloudscape-design/components';
import Condition from '../condition';
import { DatasetContext, datasetFromS3Uri } from '../../shared/util/dataset-utils';
import { DatasetResourceSelectorProps } from './dataset-selector.types';
import { DatasetResourceSelectorMode, DatasetResourceSelectorState, datasetResourceSelectorReducer } from './dataset-selector.reducer';
import DatasetBrowser from './dataset-browser';
import Modal, { ModalProps } from '../modal';
import { enumToOptions } from '../../shared/util/enum-utils';
import { DatasetType } from '../../shared/model';
import { useAuth } from 'react-oidc-context';
import { useParams } from 'react-router-dom';
import { getUsername } from '../../shared/util/auth-utils';

export function DatasetResourceSelector (props: DatasetResourceSelectorProps) {
    const username = getUsername(useAuth());
    const { projectName = '' } = useParams();
    const isSelectingObject = (props.selectableItemsTypes || []).includes('objects');
    const isSelectingPrefix = (props.selectableItemsTypes || []).includes('prefixes');
    const s3UriPlaceholder = isSelectingObject ? 's3://bucket/prefix/object' : 's3://bucket/prefix/';
    const datasetContext = datasetFromS3Uri(props.resource);

    const [state, setState] = React.useReducer(datasetResourceSelectorReducer, {
        showModal: false,
        mode: DatasetResourceSelectorMode.Browser,
        resource: props.resource,
        selected: undefined,
        form: {
            type: DatasetType.PRIVATE,
            name: '',
            username,
            projectName
        }
    });

    useEffect(() => {
        setState({
            showModal: false,
            mode: DatasetResourceSelectorMode.Browser,
            resource: props.resource,
            selected: undefined
        });
    }, [props.resource]);

    const fieldProps = {
        label: props.label || 'Dataset URI',
        description: props.description,
        constraintText: props.constraintText,
        errorText: props.errorText
    };

    const wrappedProps = {
        ...props,
        value: props.resource,
        placeholder: props.placeholder || s3UriPlaceholder,
        onChange: (event) => {
            let errorText: undefined | string = undefined;
            if (`${event.detail.value}`.length > 0) {
                const dataset = datasetFromS3Uri(event.detail.value);
                const endsWithSlash = /\/$/.test(event.detail.value);
                const validDataset = endsWithSlash ? !!dataset : !!datasetFromS3Uri(`${props.resource}/`);

                if (validDataset && !isSelectingObject && !endsWithSlash) {
                    errorText = 'URI must end with \'/\'';
                } else if (validDataset && !isSelectingPrefix && endsWithSlash) {
                    errorText = 'URI cannot end with \'/\'';
                } else if (!validDataset){
                    errorText = 'Invalid Dataset URI';
                }
            }

            return props.onChange?.({...event, detail: {
                resource: event.detail.value,
                errorText
            }});
        },
        onBlur: (event) => {
            return props.onBlur?.(event);
        }
    };

    const modalProperties = createModalProperties(state, setState, props);

    return (
        <>
            <FormField {...fieldProps}>
                <Grid gridDefinition={[{colspan: 6}, {colspan: 6}]}>
                    <Input {...wrappedProps} type='search'></Input>
                    <SpaceBetween direction='horizontal' size='m'>
                        <Condition condition={false}>
                            <Button disabled={!props.resource || !datasetContext} onClick={() => {
                                setState({
                                    showModal: true,
                                    mode: DatasetResourceSelectorMode.Browser,
                                    resource: props.resource,
                                    selected: undefined
                                });
                            }}>View</Button>
                        </Condition>
                        <Button onClick={() => {
                            setState({
                                showModal: true,
                                mode: DatasetResourceSelectorMode.Browser,
                                resource: '',
                                selected: undefined
                            });
                        }}>Browse Datasets</Button>
                        <Button onClick={() => {
                            setState({
                                showModal: true,
                                mode: DatasetResourceSelectorMode.Create,
                                resource: ''
                            });
                        }}>Create New</Button>
                    </SpaceBetween>
                </Grid>
            </FormField>

            <Condition condition={state.showModal && modalProperties !== undefined}>
                {/* modalProperties can never be undefined due to check in previous line */}
                <Modal {...modalProperties!}>
                    <>
                        <Condition condition={state.mode === DatasetResourceSelectorMode.Browser}>
                            <DatasetBrowser
                                resource={state.showModal ? state.resource || '' : ''}
                                selectableItemsTypes={props.selectableItemsTypes}
                                onSelectionChange={({detail: {selectedItem}}) => {
                                    setState({
                                        selected: selectedItem
                                    });
                                }}
                            />
                        </Condition>
                        <Condition condition={state.mode === DatasetResourceSelectorMode.Create}>
                            <SpaceBetween size='m' direction='vertical'>
                                <FormField label='Dataset name' description='Maximum of 255 characters. Must be unique to the type that you choose. The dataset name must be unique to the scope (Global/Private/Project).'>
                                    <Select selectedOption={enumToOptions(DatasetType, true).find((o) => o.value === state.form.type)!} options={enumToOptions(DatasetType, true)}  onChange={({detail}) => {
                                        setState({
                                            ...state,
                                            form: {
                                                ...state.form,
                                                type: DatasetType[detail.selectedOption?.value?.toUpperCase() as keyof typeof DatasetType]
                                            }
                                        });
                                    }}  />
                                </FormField>

                                <FormField label='Dataset type' description='Global datasets are accessible from any project, project datasets are accessible only to the project they were created in, and private datasets are accessible to the user that created them.'>
                                    <Input value={state.form.name} type='text' onChange={({detail}) => {
                                        setState({
                                            ...state,
                                            form: {
                                                ...state.form,
                                                name: detail.value
                                            }
                                        });
                                    }} />
                                </FormField>
                            </SpaceBetween>
                        </Condition>
                    </>
                </Modal>
            </Condition>
        </>
    );
}

const createModalProperties = (state: DatasetResourceSelectorState, setState: Dispatch<Partial<DatasetResourceSelectorState>>, props: DatasetResourceSelectorProps): ModalProps | undefined => {
    switch (state.mode) {
        case DatasetResourceSelectorMode.Browser:
            return {
                size: 'max',
                title: 'Browse Datasets',
                visible: state.mode === DatasetResourceSelectorMode.Browser,
                dismissText: 'Cancel',
                confirmText: 'Select',
                onDismiss () {
                    setState({
                        showModal: false
                    });
                },
                onConfirm () {
                    props.onChange?.(new CustomEvent('onChange', {cancelable: false, detail: {resource: state.selected || ''}}));
                    setState({
                        showModal: false
                    });
                },
                disableConfirm: !state.selected
            };
        case DatasetResourceSelectorMode.Create:
            return {
                size: 'large',
                visible: state.mode === DatasetResourceSelectorMode.Create,
                title: 'Create Dataset',
                dismissText: 'Cancel',
                confirmText: 'Create',
                onDismiss () {
                    setState({
                        showModal: false
                    });
                },
                onConfirm () {
                    const datasetContext: DatasetContext = {
                        Type: state.form.type,
                        Name: state.form.name
                    };

                    props.onChange?.(new CustomEvent('onChange', {cancelable: false, detail: {resource: `s3://${window.env.DATASET_BUCKET}/datasets/${datasetContext.Type.toLocaleLowerCase()}/${datasetContext.Name}`}}));
                    setState({
                        showModal: false
                    });
                },
                disableConfirm: !state.form.name
            };
    }
};

export default DatasetResourceSelector;