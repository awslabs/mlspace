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

import React, { useEffect, useState } from 'react';
import { Modal as CloudscapeModal, Box, SpaceBetween, Button } from '@cloudscape-design/components';
import { ModalProps } from '../modal';

function Modal ({
    title,
    visible,
    dismissText,
    confirmText,
    onDismiss,
    onConfirm,
    children,
    showLoading = true,
    size,
    disableConfirm = false
}: ModalProps) {
    const [confirmed, setConfirmed] = useState(false);
    useEffect(() => {
        if (!visible) {
            setConfirmed(false);
        }
    }, [visible]);

    return (
        <CloudscapeModal
            onDismiss={onDismiss}
            visible={visible}
            closeAriaLabel='Close modal'
            footer={
                <Box float='right'>
                    <SpaceBetween direction='horizontal' size='xs'>
                        <Button data-cy='modal-cancel-btn' onClick={() => onDismiss(new CustomEvent('dismiss', {cancelable: false, detail: {reason: 'dismissButton'}}))}>
                            {dismissText}
                        </Button>
                        <Button
                            disabled={disableConfirm}
                            data-cy='modal-confirm-btn'
                            variant='primary'
                            onClick={() => {
                                setConfirmed(true);
                                onConfirm(new CustomEvent('confirm', {cancelable: false}));
                            }}
                            loading={showLoading && confirmed}
                        >
                            {confirmText}
                        </Button>
                    </SpaceBetween>
                </Box>
            }
            header={title}
            size={size}
        >
            {children}
        </CloudscapeModal>
    );
}

export default Modal;
