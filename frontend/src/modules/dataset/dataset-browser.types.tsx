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
import { DatasetResource } from './dataset-browser.reducer';

/**
 * Represents the different modes that {@link DatasetBrowser} can be in depending on
 * the content to be displayed.
 */
export enum DatasetBrowserDisplayMode {
    Scope = 'Scope',
    Dataset = 'Dataset',
    Resource = 'Resource'
}

type DatasetBrowserSelectionChangeDetail = {
    selectedItem?: string;
};

export type DatasetBrowserSelectableItems = 'prefixes' | 'objects';

export type DatasetBrowserProps = {
    /**
     * S3 path for a resource.
     */
    resource: string;

    /**
     * Whether to pin the {@link DatasetBrowser} to a specific dataset. If true no option to select scope and dataset
     * will be presented.
     */
    isPinned?: boolean;

    /**
     * The columns configuration object
     * * `id` (string) - Specifies a unique column identifier. The property is used 1) as a [keys](https://reactjs.org/docs/lists-and-keys.html#keys) source for React rendering,
     *   and 2) to match entries in the `columnDisplay` property, if defined.
     * * `header` (ReactNode) - Determines the display of the column header.
     * * `cell` ((item) => ReactNode) - Determines the display of a cell's content. You receive the current table row
     *   item as an argument.
     * * `width` (string | number) - Specifies the column width. Corresponds to the `width` css-property. If the width is not set,
     *   the browser automatically adjusts the column width based on the content. When `resizableColumns` property is
     *   set to `true`, additional constraints apply: 1) string values are not allowed, and 2) the last visible column always
     *   fills the remaining space of the table so the specified width is ignored.
     * * `minWidth` (string | number) - Specifies the minimum column width. Corresponds to the `min-width` css-property. When
     *   `resizableColumns` property is set to `true`, additional constraints apply: 1) string values are not allowed,
     *   and 2) the column can't resize below than the specified width (defaults to "120px"). We recommend that you set a minimum width
     *   of at least 176px for columns that are editable.
     * * `maxWidth` (string | number) - Specifies the maximum column width. Corresponds to the `max-width` css-property.
     *   Note that when the `resizableColumns` property is set to `true` this property is ignored.
     * * `ariaLabel` (LabelData => string) - An optional function that's called to provide an `aria-label` for the cell header.
     *   It receives the current sorting state of this column, the direction it's sorted in, and an indication of
     *   whether the sorting is disabled, as three Boolean values: `sorted`, `descending` and `disabled`.
     *   We recommend that you use this for sortable columns to provide more meaningful labels based on the
     *   current sorting direction.
     * * `editConfig` (EditConfig) - Enables inline editing in column when present. The value is used to configure the editing behavior.
     * * * `editConfig.ariaLabel` (string) - Specifies a label for the edit control. Visually hidden but read by screen readers.
     * * * `editConfig.errorIconAriaLabel` (string) - Specifies an ariaLabel for the error icon that is displayed when the validation fails.
     * * * `editConfig.editIconAriaLabel` (string) - Specifies an alternate text for the edit icon used in column header.
     * * * `editConfig.constraintText` (string) - Constraint text that is displayed below the edit control.
     * * * `editConfig.disabledReason` ((item) => string | undefined) - A function that determines whether inline edit for certain items is disabled, and provides a reason why.
     *            Return a string from the function to disable inline edit with a reason. Return `undefined` (or no return) from the function allow inline edit.
     * * * `editConfig.validation` ((item, value) => string) - A function that allows you to validate the value of the edit control.
     *            Return a string from the function to display an error message. Return `undefined` (or no return) from the function to indicate that the value is valid.
     * * * `editConfig.editingCell` ((item, cellContext) => ReactNode) - Determines the display of a cell's content when inline editing is active on a cell;
     *        You receive the current table row `item` and a `cellContext` object as arguments.
     *        The `cellContext` object contains the following properties:
     *  *  * `cellContext.currentValue` - State to keep track of a value in input fields while editing.
     *  *  * `cellContext.setValue` - Function to update `currentValue`. This should be called when the value in input field changes.
     *  * `isRowHeader` (boolean) - Specifies that cells in this column should be used as row headers.
     */
    columnDefinitions?: ReadonlyArray<TableProps.ColumnDefinition<IDataset | DatasetResource>>;

    /**
     * An array of the item types that are selectable in the table view. The array may contain the following items:
     * 'prefixes' or 'objects'. Example: ['prefixes', 'objects']. By default, no items are selectable.
     */
    selectableItemsTypes?: ReadonlyArray<DatasetBrowserSelectableItems>;

    /**
     * Fired when a user interaction triggers a change in the list of selected items.
     * The event `detail` contains the current `selectedItem`.
     */
    onSelectionChange?: NonCancelableEventHandler<DatasetBrowserSelectionChangeDetail>;
} & Omit<TableProps, 'items' | 'loading' | 'trackBy' | 'columnDefinitions' | 'selectionType' | 'selectedItems' | 'filter' | 'pagination' | 'preferences' | 'isItemDisabled' | 'sortingColumn' | 'sortingDescending' | 'sortingDisabled' | 'onSortingChange' | 'onSelectionChange' | 'variant' | 'totalItemsCount'>;

