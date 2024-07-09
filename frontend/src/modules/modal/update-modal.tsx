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

import { Modal as CloudscapeModal, Box, SpaceBetween, Button } from '@cloudscape-design/components';
import { PayloadAction } from '@reduxjs/toolkit';
import { AxiosResponse } from 'axios';
import React, { useState } from 'react';
import { IProjectUser } from '../../shared/model/projectUser.model';
import { IUser } from '../../shared/model/user.model';
import { useAppDispatch } from '../../config/store';
import { CallbackFunction } from '../../types';
import { dismissModal } from './modal.reducer';
import { useNotificationService } from '../../shared/util/hooks';

export type UpdateModalProps = {
    selectedUser: IUser | IProjectUser;
    onConfirm: () => Promise<PayloadAction<any, string>> | Promise<AxiosResponse<any, any>>;
    postConfirm?: CallbackFunction;
    description?: string;
};

function UpdateModal ({ selectedUser, onConfirm, postConfirm, description }: UpdateModalProps) {
    const [processing, setProcessing] = useState(false);
    const dispatch = useAppDispatch();
    const notificationService = useNotificationService(dispatch);
    const username = (selectedUser as IUser).username || (selectedUser as IProjectUser).user;

    const responseHandler = (
        response: PayloadAction<any, string> | AxiosResponse<any, any> | undefined
    ) => {
        if (response) {
            let success = false;
            if ((response as PayloadAction).type !== undefined) {
                success = (response as PayloadAction).type.endsWith('/fulfilled');
            } else {
                success = (response as AxiosResponse).status === 200;
            }

            notificationService.generateNotification(
                `${success ? 'Successfully' : 'Failed to'} update${
                    success ? 'd' : ''
                }  ${username}.`,
                success ? 'success' : 'error'
            );
        }
    };

    return (
        <CloudscapeModal
            onDismiss={() => dispatch(dismissModal())}
            visible={true}
            closeAriaLabel='Close modal'
            footer={
                <Box float='right'>
                    <SpaceBetween direction='horizontal' size='xs'>
                        <Button onClick={() => dispatch(dismissModal())}>Cancel</Button>
                        <Button
                            variant='primary'
                            onClick={async () => {
                                setProcessing(true);
                                const response = await onConfirm();
                                responseHandler(response);
                                dispatch(dismissModal());
                                if (postConfirm) {
                                    postConfirm();
                                }
                            }}
                            loading={processing}
                        >
                            Confirm
                        </Button>
                    </SpaceBetween>
                </Box>
            }
            header={`Confirm for "${username}"?`}
        >
            {description}
        </CloudscapeModal>
    );
}

export default UpdateModal;
