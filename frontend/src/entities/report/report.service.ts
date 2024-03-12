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

import { IReport } from '../../shared/model/report.model';
import axios from '../../shared/util/axios-utils';

export type ReportScope = 'project' | 'system' | 'user';

type reportRequestProps = {
    resources: string[];
    scope: ReportScope;
    targets?: string[];
};

export const createReport = async (params: reportRequestProps) => {
    return axios.post<any>('/report', JSON.stringify({
        requestedResources: params.resources,
        scope: params.scope,
        targets: params.targets
    }));
};

export const listReports = async () => {
    return axios.get<IReport[]>('/report').then((response) => response.data);
};

export const downloadReport = async (reportName: string) => {
    return axios.get<string>(`/report/${reportName}`).then((response) => response.data);
};

export const deleteReport = async (reportName: string) => {
    return axios.delete<string>(`/report/${reportName}`).then((response) => response.data);
};
