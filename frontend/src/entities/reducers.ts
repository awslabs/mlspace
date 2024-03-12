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

import user from './user/user.reducer';
import notebook from './notebook/notebook.reducer';
import project from './project/project.reducer';
import projectCard from './project/card/project-card.reducer';
import dataset from './dataset/dataset.reducer';
import model from './model/model.reducer';
import jobs from './jobs/jobs.reducer';
import endpoint from './endpoint/endpoint.reducer';
import endpointConfig from './endpoint-config/endpoint-config.reducer';
import modal from '../modules/modal/modal.reducer';
import emr from './emr/emr.reducer';
import logs from '../shared/logs/logs.reducer';
import batchTranslateJob from './batch-translate/batch-translate.reducer';

const entitiesReducers = {
    user,
    notebook,
    project,
    projectCard,
    dataset,
    model,
    jobs,
    endpoint,
    endpointConfig,
    modal,
    emr,
    logs,
    batchTranslateJob,
};

export default entitiesReducers;
