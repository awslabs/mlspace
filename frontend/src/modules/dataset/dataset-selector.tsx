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
import React, { useCallback, useEffect } from 'react';
import { Alert, Button, FormField, FormFieldProps, Grid, Input, SpaceBetween} from '@cloudscape-design/components';
import Condition from '../condition';
import { DatasetResourceSelectorProps } from './dataset-selector.types';
import { DatasetResourceSelectorMode, datasetResourceSelectorReducer } from './dataset-selector.reducer';
import DatasetBrowser from './dataset-browser';
import Modal from '../modal';
import { useParams } from 'react-router-dom';
import { useUsername } from '../../shared/util/auth-utils';
import { modalPropertiesForBrowse, modalPropertiesForCreate } from './dataset-selector.utils';
import { DatasetInlineCreate } from './dataset-inline-create';
import { extractPrefixedType } from '../../shared/util/types';
import { useAppDispatch } from '../../config/store';
import { getDatasetContents } from './dataset-browser.reducer';
import { datasetFromS3Uri } from '../../shared/util/dataset-utils';
import { isFulfilled } from '@reduxjs/toolkit';
import { debounce } from 'lodash';
import { DatasetType } from '../../shared/model';

export function DatasetResourceSelector (props: DatasetResourceSelectorProps) {
    const username = useUsername();
    const { projectName = '' } = useParams();
    const isSelectingObject = (props.selectableItemsTypes || []).includes('objects');
    const isSelectingPrefixes = (props.selectableItemsTypes || []).includes('prefixes');
    const s3UriPlaceholder = isSelectingObject ? 's3://bucket/prefix/object' : 's3://bucket/prefix/';
    const dispatch = useAppDispatch();

    const [state, setState] = React.useReducer(datasetResourceSelectorReducer, {
        mode: DatasetResourceSelectorMode.None,
        resource: props.resource,
        selected: undefined,
        isEmpty: false,
    });

    // disable since debounce() interferes with the linter tracking dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const updateIsEmpty = useCallback(debounce((s3Uri: string) => {
        const datasetContext = datasetFromS3Uri(s3Uri);

        if (datasetContext?.name) {
            dispatch(getDatasetContents({
                username,
                projectName,
                datasetContext,
                delimiter: ''
            })).then((response) => {
                let scope = String(datasetContext.type);
                switch (datasetContext.type) {
                    case DatasetType.PRIVATE:
                        scope += `/${username}`;
                        break;
                    case DatasetType.PROJECT:
                        scope += `/${projectName}`;
                        break;
                }
    
                let isEmpty = true;
                if (isFulfilled(response)) {
                    const location = [scope, 'datasets', datasetContext.name, `${datasetContext.location}`].filter(Boolean).join('/');
                    // check if any resource is an exact match or has a matching prefix
                    isEmpty = !response.payload.data.contents.find((resource) => {
                        if (resource.type !== 'object') {
                            return false;
                        }

                        return (isSelectingObject && resource.key === location) ||
                            (isSelectingPrefixes && resource.key.startsWith(`${location}/`.replace(/\/+$/, '/')));
                    });
                }

                setState({
                    isEmpty
                });
            });                
        }
    }, 300), [dispatch, username, projectName, isSelectingObject, isSelectingPrefixes]);

    // if resource changes reset to defaults
    useEffect(() => {
        setState({
            mode: DatasetResourceSelectorMode.None,
            resource: props.resource,
            selected: undefined
        });

        if (props.alertOnEmpty && props.resource) {
            updateIsEmpty(props.resource);
        }
    }, [props.resource, props.alertOnEmpty, updateIsEmpty, props.selectableItemsTypes]);

    const fieldProps: FormFieldProps = extractPrefixedType(props, 'field');
    const inputProps = {
        ...extractPrefixedType(props, 'input'),
        value: props.resource,
        onChange: (event) => {
            return props.onChange?.({...event, detail: {
                resource: event.detail.value
            }});
        },
        onBlur: (event) => {
            return props.inputOnBlur?.(event);
        }
    };

    return (
        <>
            <FormField {...fieldProps}>
                <Grid gridDefinition={[{colspan: 6}, {colspan: 6}]}>
                    <SpaceBetween direction='vertical' size='xs'>
                        <Input placeholder={s3UriPlaceholder} {...inputProps} type='search'></Input>
                        <Condition condition={!!props.alertOnEmpty && state.isEmpty}>
                            <Alert statusIconAriaLabel='Warning' type='warning'>
                                <Condition condition={isSelectingObject && isSelectingPrefixes}>
                                        No file found with this name and no files found with this prefix.
                                </Condition>
                                <Condition condition={isSelectingObject && !isSelectingPrefixes}>
                                        No file found with this name.
                                </Condition>
                                <Condition condition={!isSelectingObject && isSelectingPrefixes}>
                                        No files found with this prefix.
                                </Condition>
                            </Alert>
                        </Condition>
                    </SpaceBetween>
                    <SpaceBetween direction='horizontal' size='m'>
                        <Button onClick={() => {
                            setState({
                                mode: DatasetResourceSelectorMode.Browse,
                                resource: '',
                                selected: undefined
                            });
                        }}>Browse Datasets</Button>
                        <Condition condition={props.showCreateButton || false}>
                            <Button onClick={() => {
                                setState({
                                    mode: DatasetResourceSelectorMode.Create,
                                    resource: ''
                                });
                            }}>Create New</Button>
                        </Condition>
                    </SpaceBetween>
                </Grid>
            </FormField>

            <>
                <Condition condition={state.mode === DatasetResourceSelectorMode.Browse}>
                    <Modal {...modalPropertiesForBrowse(state, setState, props)}>
                        <DatasetBrowser
                            resource={state.resource || ''}
                            selectableItemsTypes={props.selectableItemsTypes}
                            onSelectionChange={useCallback(({detail: {selectedItems}}) => {
                                let selected: string | undefined = undefined;

                                const selectedItem = selectedItems?.[0];
                                if (selectedItem) {
                                    switch (selectedItem?.type) {
                                        // if type is object then selected item is DatasetResourceObject
                                        case 'object':
                                            selected = `s3://${selectedItem.bucket}/${selectedItem.key}`;
                                            break;
                                        // if type is prefix then selected item is DatasetResourcePrefix
                                        case 'prefix':
                                            selected = `s3://${selectedItem.bucket}/${selectedItem.prefix}`;
                                            break;
                                        // otherwise selected item is IDataset
                                        default:
                                            selected = selectedItem.location;
                                    }

                                }
                                
                                setState({selected});
                            }, [setState])}
                        />
                    </Modal>
                </Condition>

                <Condition condition={state.mode === DatasetResourceSelectorMode.Create}>
                    <Modal {...modalPropertiesForCreate(state, setState, props)}>
                        <DatasetInlineCreate
                            username={username}
                            projectName={projectName}
                            onChange={useCallback(({detail}) => {
                                setState({
                                    newDatasetUri: detail.value
                                });
                            }, [setState])} />
                    </Modal>
                </Condition>
            </>
        </>
    );
}

export default DatasetResourceSelector;