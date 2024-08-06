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
import * as React from 'react';
import { BreadcrumbGroupProps, Link, TableProps } from '@cloudscape-design/components';
import { upperFirst } from 'lodash';
import { DatasetType, IDataset } from '../../shared/model';
import { DatasetContext } from '../../shared/util/dataset-utils';
import { DatasetBrowserState, DatasetResource } from './dataset-browser.reducer';
import { formatDisplayNumber } from '../../shared/util/form-utils';
import { convertBytesToHumanReadable } from '../../entities/dataset/create/dataset-upload.utils';
import { DatasetBrowserDisplayMode, DatasetBrowserManageMode, DatasetBrowserSelectableItems, UpdateDatasetContextFunction } from './dataset-browser.types';

/**
 * Returns the prefix for the provided path or an empty string if no prefix
 * exists on the path.
 * @param path relative s3 bucket path
 * @returns 
 */
export const prefixForPath = (path?: string): string => {
    return path?.match(/.*\/(?=[^/]*?$)/)?.[0] || '';
};

/**
 * Returns the resource for the provided path or an empty string if no resource
 * exists on the path.
 * @param path relative s3 bucket path
 * @returns 
 */
export const resourceForPath = (path?: string): string => {
    return path?.match(/[^/]*?$/)?.[0] || '';
};

/**
 * Returns the last component for the provided path or an empty string.
 * @param path relative s3 bucket path
 * @returns 
 */
export const lastComponent = (path?: string): string => {
    return path?.match(/[^/]+?\/?$/)?.[0] || '';
};

/**
 * Returns the remaining path after the dataset path prefix has been removed.
 * @param path relative s3 bucket path
 * @returns 
 */
export const stripDatasetPrefix = (path?: string): string => {
    return path?.replace(/.+?\/datasets\/[^/]+?\//, '') || '';
};

/**
 * Determines appropriate {@link DatasetBrowserDisplayMode} for {@param datasetContext}
 * 
 * @param {DatasetContext} datasetContext optional context to get mode for
 * @returns {DatasetBrowserDisplayMode}
 */
export const modeForDatasetContext = (datasetContext?: Partial<DatasetContext>): DatasetBrowserDisplayMode => {
    if (datasetContext?.type) {
        if (datasetContext?.name) {
            return DatasetBrowserDisplayMode.Resource;
        }

        return DatasetBrowserDisplayMode.Dataset;
    }

    return DatasetBrowserDisplayMode.Scope;
};

/**
 * Create {@link TableProps} for {@param displayMode}
 * 
 * @param {DatasetBrowserState} state current state
 * @param {Dispatch<DatasetBrowserAction>} setState function for dispathcing actions to update the component state
 * @param {ThunkDispatch<any, undefined, AnyAction> & Dispatch<AnyAction>} dispatch function for dispatching actions to update the application state
 * @returns 
 */
export function tablePropertiesForDisplayMode (displayMode: DatasetBrowserDisplayMode, state: DatasetBrowserState, updateDatasetContext: UpdateDatasetContextFunction): Partial<TableProps> & Pick<TableProps, 'columnDefinitions'> {
    switch (displayMode) {
        case DatasetBrowserDisplayMode.Resource:
            return tablePropertiesForDatasetResources(state, updateDatasetContext);
        case DatasetBrowserDisplayMode.Dataset:
            return tablePropertiesForDatasets(state, updateDatasetContext);
        case DatasetBrowserDisplayMode.Scope:
            return tablePropertiesForScopes(state, updateDatasetContext);
    }
}

function tablePropertiesForDatasetResources (state: DatasetBrowserState, updateDatasetContext: UpdateDatasetContextFunction): Partial<TableProps<DatasetResource>> & Pick<TableProps, 'columnDefinitions'> {
    return {
        trackBy: 'name',
        columnDefinitions: [{
            id: 'name',
            header: 'Name',
            cell (item) {
                switch (item.type) {
                    case 'prefix':                       
                        return (
                            <Link data-cy={item.name} onFollow={() => {
                                updateDatasetContext({ ...state.datasetContext!, location: stripDatasetPrefix(item.prefix) }, '', false);
                            } }>{item.name}</Link>
                        );
                    case 'object':
                        return (
                            <div data-cy={item.name}>{item.name}</div>
                        );
                }
            },
        }, {
            id: 'size',
            header: 'Size',
            cell (item) {
                if (item.type === 'object' && item.size) {
                    return convertBytesToHumanReadable(item.size);
                }
    
                return formatDisplayNumber(undefined);
            }
        }]
    };
}

function tablePropertiesForDatasets (state: DatasetBrowserState, updateDatasetContext: UpdateDatasetContextFunction): Partial<TableProps<IDataset>> & Pick<TableProps, 'columnDefinitions'> {
    return {
        trackBy: 'name',
        columnDefinitions: [{
            id: 'dataset',
            header: 'Dataset Name',
            cell (item) {
                return (
                    <Link data-cy={item.name} onFollow={() => {
                        updateDatasetContext({ ...state.datasetContext, name: item.name, scope: item.scope }, '', false);
                    } }>{item.name}</Link>
                );
            },
        }]
    };    
}

function tablePropertiesForScopes (state: DatasetBrowserState, updateDatasetContext: UpdateDatasetContextFunction): Partial<TableProps<{key: string, type: DatasetType}>> & Pick<TableProps, 'columnDefinitions'> {
    return {
        trackBy: 'type',
        isItemDisabled () {
            return true; 
        },
        columnDefinitions: [{
            id: 'name',
            header: 'Name',
            cell (item) {
                return (
                    <Link data-cy={item.name} onFollow={() => {
                        updateDatasetContext({type: item.type }, '', false);
                    } }>{item.name}</Link>
                );
            },
        }]
    };
}

/**
 * Creates an array of breadcrumb items for {@param datasetContext}
 *
 * @param {DatasetContext} datasetContext optional dataset to build breadcrumbs from
 * @returns {BreadcrumbGroupProps.Item[]}
 */
export function breadcrumbFromDataset (datasetContext?: Partial<DatasetContext>, isPinned = false): BreadcrumbGroupProps.Item[] {
    const breadcrumbs = [{
        text: 'Scopes',
        href: ''
    }];

    if (datasetContext) {
        breadcrumbs.push({
            text: upperFirst(datasetContext.type),
            href: JSON.stringify({ type: datasetContext.type })
        });

        if (datasetContext.name) {
            breadcrumbs.push({
                text: datasetContext.name,
                href: JSON.stringify({ type: datasetContext.type, name: datasetContext.name })
            });

            prefixForPath(datasetContext.location).split('/').reduce<string | undefined>((previous, current) => {
                const location = [previous, `${current}/`].filter(Boolean).join('');
                if (current) {
                    breadcrumbs.push({
                        text: `${current}/`,
                        href: JSON.stringify({ type: datasetContext.type, name: datasetContext.name, location: location })
                    });
                }
                return location;
            }, undefined);
        }
    }

    if (isPinned) {
        breadcrumbs.splice(0,2);
    }

    return breadcrumbs;
}

export const getSelectionType = (mode?: DatasetBrowserManageMode, selectableItemsTypes?: readonly DatasetBrowserSelectableItems[]): TableProps.SelectionType | undefined => {
    if (mode) {
        return 'multi';
    }

    if (selectableItemsTypes) {
        return 'single';
    }
};