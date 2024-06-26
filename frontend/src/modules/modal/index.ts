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

import { NonCancelableEventHandler } from '@cloudscape-design/components/internal/events';
import Modal from './modal';
import { ModalProps as CloudscapeModalProps } from '@cloudscape-design/components';

type ModalProps =  {
    title: string;
    visible: boolean;
    dismissText: string;
    confirmText: string;
    onDismiss: NonCancelableEventHandler<CloudscapeModalProps.DismissDetail>;
    onConfirm: NonCancelableEventHandler
    children?: JSX.Element;
    showLoading?: boolean;
    size?: CloudscapeModalProps.Size;
    disableConfirm?: boolean
};

export default Modal;
export type { ModalProps };
