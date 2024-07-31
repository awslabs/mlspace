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

import React, { Route, Navigate, Outlet } from 'react-router-dom';
import ErrorBoundaryRoutes from '../shared/error/error-boundary-routes';
import Notebook from './notebook';
import NotebookCreate from './notebook/create';
import NotebookDetail from './notebook/detail';
import Dataset from './dataset';
import DatasetCreate from './dataset/create';
import DatasetUpdate from './dataset/update';
import DatasetDetail from './dataset/detail';
import Model from './model';
import ModelCreate from './model/create';
import ModelDetail from './model/detail';
import User from './user';
import Group from './group';
import ProjectDetail from './project/detail';
import ProjectCreate from './project/create';
import ProjectUser from './project/users/project-user';
import TrainingJobRoutes from './jobs/training/training-job.routes';
import EndpointConfig from './endpoint-config';
import TransformJobRoutes from './jobs/transform';
import EndpointConfigDetails from './endpoint-config/detail/';
import EndpointConfigCreate from './endpoint-config/create/';
import Endpoint from './endpoint';
import EndpointDetails from './endpoint/detail/';
import EndpointCreate from './endpoint/create/';
import HPOJobRoutes from './jobs/hpo/hpo.routes';
import LabelingJobRoutes from './jobs/labeling/labeling-job.routes';
import EMRClusters from './emr/emr-clusters';
import EMRClusterCreate from './emr/create/emr-cluster-create';
import Configuration from './configuration/configuration';
import Report from './report/report';
import { selectCurrentUser } from './user/user.reducer';
import { useAppDispatch, useAppSelector } from '../config/store';
import { hasPermission, enableProjectCreation } from '../shared/util/permission-utils';
import { Permission } from '../shared/model/user.model';
import ResourceNotFound from '../modules/resource-not-found';
import EMRDetail from './emr/detail/emr-clusters-detail';
import BatchTranslate from './batch-translate';
import BatchTranslateCreate from './batch-translate/create';
import BatchTranslateDetail from './batch-translate/detail';
import TranslateRealtime from './translate-realtime/translate-realtime';
import { appConfig } from './configuration/configuration-reducer';
import { IAppConfiguration } from '../shared/model/app.configuration.model';
import GroupCreate from './group/create';
import GroupDetail from './group/detail';
import UserDetail from './user/detail';
import ProjectGroups from './project/detail/groups';
import { AdminBasePath, PersonalBasePath, ProjectBasePath, setBasePath } from '../config/base-path.reducer';

const EntityRoutes = () => {
    const applicationConfig: IAppConfiguration = useAppSelector(appConfig);
    const currentUser = useAppSelector(selectCurrentUser);
    const dispatch = useAppDispatch();


    return (
        <div>
            <ErrorBoundaryRoutes>
                <Route path='/admin' element={<RequireAdmin />} action={() => dispatch(setBasePath(AdminBasePath))}>
                    <Route path='users' element={<User />} />
                    <Route path='users/:username' element={<UserDetail />} />
                    <Route path='groups' element={<Group />} />
                    <Route path='groups/create' element={<GroupCreate />} />
                    <Route path='groups/edit/:groupName' element={<GroupCreate isEdit={true} />} />
                    <Route path='groups/:groupName' element={<GroupDetail />} />
                    <Route path='configuration' element={<Configuration />} />
                    <Route path='reports' element={<Report />} />
                </Route>

                <Route path='/personal' action={() => dispatch(setBasePath(PersonalBasePath))}>
                    <Route path='group' element={<Group />} />
                    <Route path='group/:groupName' element={<GroupDetail />} />
                    <Route path='dataset' element={<Dataset />} />
                    <Route path='dataset/create' element={<DatasetCreate />} />
                    <Route path='dataset/:type/:scope/:name/edit' element={<DatasetUpdate />} />
                    <Route path='dataset/:type/:scope/:name' element={<DatasetDetail />} />
                    <Route path='notebook' element={<Notebook />} />
                    <Route path='notebook/create' element={<NotebookCreate />} />
                    <Route path='notebook/:name' element={<NotebookDetail />} />
                    <Route path='notebook/:name/edit' element={<NotebookCreate update={true} />}/>
                    {applicationConfig.configuration.EnabledServices.realtimeTranslate &&
                        <Route path='personal/translate/realtime' element={<TranslateRealtime />} />
                    }
                </Route>
            
                <Route path='/project' action={() => dispatch(setBasePath(ProjectBasePath))}>
                    {enableProjectCreation(applicationConfig.configuration.ProjectCreation.isAdminOnly, currentUser) ? (
                        <Route path='project/create' element={<ProjectCreate />} />
                    ) : undefined}
                    <Route path=':projectName' element={<ProjectDetail />} />
                    <Route path=':projectName/edit' element={<ProjectCreate isEdit={true} />} />
                    <Route path=':projectName/user' element={<ProjectUser />} />
                    <Route path=':projectName/groups' element={<ProjectGroups />} />
                    <Route path=':projectName/endpoint' element={<Endpoint />} />
                    <Route path=':projectName/endpoint/create' element={<EndpointCreate />} />
                    <Route path=':projectName/endpoint/:name' element={<EndpointDetails />} />
                    <Route path=':projectName/endpoint-config' element={<EndpointConfig />} />
                    <Route
                        path=':projectName/endpoint-config/create'
                        element={<EndpointConfigCreate />}
                    />
                    <Route
                        path=':projectName/endpoint-config/:name'
                        element={<EndpointConfigDetails />}
                    />
                    <Route path=':projectName/notebook' element={<Notebook />} />
                    <Route path=':projectName/notebook/create' element={<NotebookCreate />} />
                    <Route path=':projectName/notebook/:name' element={<NotebookDetail />} />
                    <Route
                        path=':projectName/notebook/:name/edit'
                        element={<NotebookCreate update={true} />}
                    />
                    <Route path=':projectName/dataset' element={<Dataset />} />
                    <Route path=':projectName/dataset/create' element={<DatasetCreate />} />
                    <Route
                        path=':projectName/dataset/:type/:scope/:name'
                        element={<DatasetDetail />}
                    />
                    <Route
                        path=':projectName/dataset/:type/:scope/:name/edit'
                        element={<DatasetUpdate />}
                    />
                    <Route path=':projectName/model' element={<Model />} />
                    <Route path=':projectName/model/create' element={<ModelCreate />} />
                    <Route path=':projectName/model/:modelName' element={<ModelDetail />} />

                    {applicationConfig.configuration.EnabledServices.labelingJob &&
                        <Route
                            path=':projectName/jobs/labeling/*'
                            element={<LabelingJobRoutes />}
                        />
                    }

                    <Route
                        path=':projectName/jobs/training/*'
                        element={<TrainingJobRoutes />}
                    />
                    <Route path=':projectName/jobs/hpo/*' element={<HPOJobRoutes />} />
                    <Route
                        path=':projectName/jobs/transform/*'
                        element={<TransformJobRoutes />}
                    />

                    {applicationConfig.configuration.EnabledServices.emrCluster &&
                        <>
                            <Route path=':projectName/emr' element={<EMRClusters />} />

                            <Route path=':projectName/emr/create' element={<EMRClusterCreate />} />
                            <Route
                                path=':projectName/emr/:clusterId/:clusterName'
                                element={<EMRDetail />}
                            />
                        </>
                    }
                    {applicationConfig.configuration.EnabledServices.batchTranslate &&
                        <>
                            <Route
                                path=':projectName/batch-translate'
                                element={<BatchTranslate />}
                            />

                            <Route
                                path=':projectName/batch-translate/create'
                                element={<BatchTranslateCreate />}
                            />
                            <Route
                                path=':projectName/batch-translate/:jobId'
                                element={<BatchTranslateDetail />}
                            />
                        </>
                    }
                </Route>
                <Route path='*' element={<ResourceNotFound />} />
            </ErrorBoundaryRoutes>
        </div>
    );
};

function RequireAdmin () {
    const currentUser = useAppSelector(selectCurrentUser);
    return hasPermission(Permission.ADMIN, currentUser.permissions) ? (
        <Outlet />
    ) : (
        <Navigate to='/404' />
    );
}

export default EntityRoutes;
