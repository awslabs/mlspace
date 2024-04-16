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
import { TableProps } from '@cloudscape-design/components';
import { NonCancelableEventHandler } from '@cloudscape-design/components/internal/events';
import { IDataset } from '../../shared/model';
import { DatasetBrowserAction, DatasetBrowserState, DatasetResource } from './dataset-browser.reducer';
import { Optional } from '../../shared/util/types';
import { Dispatch as ReduxDispatch } from '@reduxjs/toolkit';
import { Dispatch as ReactDispatch } from 'react';

/**
 * Represents the different modes that {@link DatasetBrowser} can be in depending on
 * the content to be displayed.
 */
export enum DatasetBrowserDisplayMode {
    Scope = 'Scope',
    Dataset = 'Dataset',
    Resource = 'Resource'
}

type DatasetBrowserItemsChangeDetail = {
    items: ReadonlyArray<(DatasetResource | IDataset)>;
};

export type DatasetBrowserSelectableItems = 'prefixes' | 'objects';

export type DatasetBrowserProps = {
    /**
     * Actions for the container.
     */
    actions?: (state: Pick<DatasetBrowserState, 'selectedItems' | 'items' | 'datasetContext' | 'manageMode' | 'filter'>, setState: ReduxDispatch<DatasetBrowserAction> | ReactDispatch<DatasetBrowserAction>) => React.ReactNode;

    /**
     * S3 path for a resource.
     */
    resource: string;

    /**
     * Whether to pin the {@link DatasetBrowser} to a specific dataset. If true no option to select scope and dataset
     * will be presented.
     */
    isPinned?: boolean;

    manageMode?: DatasetBrowserManageMode,

    /**
     * An array of the item types that are selectable in the table view. The array may contain the following items:
     * 'prefixes' or 'objects'. Example: ['prefixes', 'objects']. By default, no items are selectable.
     */
    selectableItemsTypes?: ReadonlyArray<DatasetBrowserSelectableItems>;

    /**
     * Fired when a user interaction triggers a change in the list of selected items.
     * The event `detail` contains the current `selectedItem`.
     */
    onSelectionChange?: NonCancelableEventHandler<TableProps.SelectionChangeDetail<DatasetResource | IDataset>>;

    /**
     * Fired when a user interaction triggers a change in the list of items.
     * The event `detail` contains the current `items`.
     */
    onItemsChange?: NonCancelableEventHandler<DatasetBrowserItemsChangeDetail>;
} & Optional<Omit<TableProps<IDataset | DatasetResource>, 'items' | 'loading' | 'trackBy' | 'selectionType' | 'selectedItems' | 'filter' | 'pagination' | 'preferences' | 'isItemDisabled' | 'sortingColumn' | 'sortingDescending' | 'sortingDisabled' | 'onSortingChange' | 'onSelectionChange' | 'variant' | 'totalItemsCount'>, 'columnDefinitions'>;

export enum DatasetBrowserManageMode {
    Create = 'Create',
    Edit = 'Edit',
    View = 'View'
}

