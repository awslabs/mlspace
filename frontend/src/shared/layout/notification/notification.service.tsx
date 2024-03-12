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

import { FlashbarProps } from '@cloudscape-design/components';
import { v4 } from 'uuid';
import { addNotification, clearNotification } from './notification.reducer';
import { Action, ThunkDispatch } from '@reduxjs/toolkit';
import { NotificationProp } from './notifications.props';

function NotificationService (dispatch: ThunkDispatch<any, any, Action>) {
    function generateNotification (header: string, type: FlashbarProps.Type) {
        const id = v4();
        dispatch(addNotification({ header: header, type: type, id: id }));
        return id;
    }

    function createNotification (props: NotificationProp) {
        return {
            id: props.id,
            header: props.header,
            type: props.type,
            dismissible: true,
            onDismiss: () => dispatch(clearNotification(props.id)),
            dismissLabel: 'Dismiss notification',
        } as FlashbarProps.MessageDefinition;
    }

    function showActionNotification (action: string, successMessage: string, actionResult: any) {
        if (actionResult.type.endsWith('/fulfilled')) {
            generateNotification(successMessage || `Successfully ${action}.`, 'success');
        } else {
            generateNotification(`Failed to ${action}: ${actionResult.payload}`, 'error');
        }
    }

    return {
        generateNotification: generateNotification,
        createNotification: createNotification,
        showActionNotification: showActionNotification,
    };
}

export default NotificationService;
