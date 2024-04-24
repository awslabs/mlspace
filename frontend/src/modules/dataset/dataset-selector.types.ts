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
import { FormFieldProps, InputProps } from '@cloudscape-design/components';
import { NonCancelableEventHandler } from '@cloudscape-design/components/internal/events';
import { IDataset } from '../../shared/model';
import { DatasetResource } from './dataset-browser.reducer';
import { PrefixedType } from '../../shared/util/types';

export type DatasetResourceSelectorSelectableItems = 'prefixes' | 'objects';

type DatasetResourceSelectorChangeDetail = {
    resource: string;
    errorText?: string;
};

export type DatasetResourceSelectorProps = {
    /**
     * An array of the item types that are selectable in the table view. The array may contain the following items:
     * 'buckets' or 'objects'. Example: ['buckets', 'objects']. By default, no items are selectable.
     * This property determines whether the component operates in Read mode or Write mode:
     * * Read mode - When 'objects' values are provided (folder selection should be disabled by
     * customizing `objectsIsItemDisabled` function).
     * * Write mode - When 'datasets' and 'objects' values are provided (file selection should be disabled by
     * customizing `objectsIsItemDisabled` function).
     */
    selectableItemsTypes?: ReadonlyArray<DatasetResourceSelectorSelectableItems>;
    /**
     * Optionally overrides whether a bucket should be disabled for selection in the Buckets view or not.
     * It has higher priority than `selectableItemsTypes`. Example: if `selectableItemsTypes` has `['buckets']` value and
     * `bucketsIsItemDisabled` returns false for a bucket, then the bucket is disabled for selection.
     */
    datasetsIsItemDisabled?: (item: IDataset) => boolean;
    /**
     * Optionally overrides whether an object should be disabled for selection in the Objects view or not. Similar to
     * `bucketsIsItemDisabled` this property takes precedence over the `selectableItemsTypes` property.
     */
    objectsIsItemDisabled?: (item: DatasetResource) => boolean;
    /**
     * The current selected resource.
     */
    resource: string;
    /**
     * Fired when the resource selection is changed. The event detail object contains resource that represents the full
     * path of the selected resource and `errorText` that may contain a validation error.
     */
    onChange?: NonCancelableEventHandler<DatasetResourceSelectorChangeDetail>;
    /**
     * Should the create button be shown.
     */
    showCreateButton?: boolean;
    /**
     * Should an alet be displayed if the file does not exist or prefix is empty.
     */
    alertOnEmpty?: boolean;
} & PrefixedType<Omit<InputProps, 'onChange' | 'selectableItemsTypes' | 'viewHref' | 'value'>, 'input'> & PrefixedType<FormFieldProps, 'field'>;