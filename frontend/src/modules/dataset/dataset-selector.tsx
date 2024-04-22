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
import { Button, FormField, Grid, Input, SpaceBetween} from '@cloudscape-design/components';
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

export function DatasetResourceSelector (props: DatasetResourceSelectorProps) {
    const username = useUsername();
    const { projectName = '' } = useParams();
    const isSelectingObject = (props.selectableItemsTypes || []).includes('objects');
    const s3UriPlaceholder = isSelectingObject ? 's3://bucket/prefix/object' : 's3://bucket/prefix/';

    const [state, setState] = React.useReducer(datasetResourceSelectorReducer, {
        mode: DatasetResourceSelectorMode.None,
        resource: props.resource,
        selected: undefined,
    });

    // if resource changes reset to defaults
    useEffect(() => {
        setState({
            mode: DatasetResourceSelectorMode.None,
            resource: props.resource,
            selected: undefined
        });
    }, [props.resource]);

    const fieldProps = extractPrefixedType(props, 'field');
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
                    <Input placeholder={s3UriPlaceholder} {...inputProps} type='search'></Input>
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