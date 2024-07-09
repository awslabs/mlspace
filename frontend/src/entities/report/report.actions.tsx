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

import { deleteReport } from './report.service';
import { Action, ThunkDispatch } from '@reduxjs/toolkit';
import { useNotificationService } from '../../shared/util/hooks';

function ReportActionHandler (
    e: any,
    reportName: string,
    dispatch: ThunkDispatch<any, any, Action>
) {
    const notificationService = useNotificationService(dispatch);

    switch (e.detail.id) {
        case 'deleteReport':
            try {
                (async () => {
                    await deleteReport(reportName);
                })();
                notificationService.generateNotification(
                    `Successfully deleted ${reportName}`,
                    'success'
                );
            } catch (error: any) {
                notificationService.generateNotification(
                    `Failed to delete ${window.env.APPLICATION_NAME} report with error: ${error.response.data}`,
                    'error'
                );
            }
            break;
        // downloadReport case is handled by the selectItemsCallback in the Table
        case 'downloadReport':
        default:
            break;
    }
}

export { ReportActionHandler };
