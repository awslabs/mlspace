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
import { Dispatch } from 'react';
import { DatasetResourceSelectorProps } from './dataset-selector.types';
import { DatasetResourceSelectorMode, DatasetResourceSelectorState } from './dataset-selector.reducer';
import { ModalProps } from '../modal';

export const modalPropertiesForCreate = (state: DatasetResourceSelectorState, setState: Dispatch<Partial<DatasetResourceSelectorState>>, props: DatasetResourceSelectorProps): ModalProps => ({
    size: 'large',
    visible: true,
    title: 'Create Dataset',
    dismissText: 'Cancel',
    confirmText: 'Create',
    onDismiss () {
        setState({
            mode: DatasetResourceSelectorMode.None
        });
    },
    onConfirm () {
        if (state.newDatasetUri) {
            props.onChange?.(new CustomEvent('onChange', { cancelable: false, detail: { resource: state.newDatasetUri } }));
        }

        setState({
            mode: DatasetResourceSelectorMode.None
        });
    },
    disableConfirm: !state.newDatasetUri
});

export const modalPropertiesForBrowse = (state: DatasetResourceSelectorState, setState: Dispatch<Partial<DatasetResourceSelectorState>>, props: DatasetResourceSelectorProps): ModalProps => ({
    size: 'max',
    title: 'Browse Datasets',
    visible: true,
    dismissText: 'Cancel',
    confirmText: 'Select',
    onDismiss () {
        setState({
            mode: DatasetResourceSelectorMode.None
        });
    },
    onConfirm () {
        props.onChange?.(new CustomEvent('onChange', { cancelable: false, detail: { resource: state.selected || '' } }));
        setState({
            mode: DatasetResourceSelectorMode.None
        });
    },
    disableConfirm: !state.selected
});
