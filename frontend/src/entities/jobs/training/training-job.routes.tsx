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

import React from 'react';
import { Route } from 'react-router-dom';
import { TrainingJobs } from './training-jobs';
import TrainingJobCreate from './create/training-job-create';
import TrainingJobDetail from './detail/training-job-detail';
import ErrorBoundaryRoutes from '../../../shared/error/error-boundary-routes';

export function TrainingJobRoutes () {
    return (
        <ErrorBoundaryRoutes>
            <Route index element={<TrainingJobs />} />
            <Route path='create' element={<TrainingJobCreate />} />
            <Route path='detail/:trainingJobName' element={<TrainingJobDetail />} />
        </ErrorBoundaryRoutes>
    );
}

export default TrainingJobRoutes;
