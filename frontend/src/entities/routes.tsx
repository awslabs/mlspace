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
import { useAppSelector } from '../config/store';
import { hasPermission, enableProjectCreation } from '../shared/util/permission-utils';
import { Permission } from '../shared/model/user.model';
// import ResourceNotFound from '../modules/resource-not-found';
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
import { BasePathContext } from '../shared/layout/base-path-context';

const EntityRoutes = () => {
    const applicationConfig: IAppConfiguration = useAppSelector(appConfig);
    const currentUser = useAppSelector(selectCurrentUser);


    return (
        <div>
            <BasePathContext.Provider value='#/admin'>
                <ErrorBoundaryRoutes>
                    <Route element={<RequireAdmin />}>
                        <Route path='admin/users' element={<User />} />
                        <Route path='admin/users/:username' element={<UserDetail />} />
                        <Route path='admin/groups' element={<Group />} />
                        <Route path='admin/groups/create' element={<GroupCreate />} />
                        <Route path='admin/groups/edit/:groupName' element={<GroupCreate isEdit={true} />} />
                        <Route path='admin/groups/:groupName' element={<GroupDetail />} />
                        <Route path='admin/configuration' element={<Configuration />} />
                        <Route path='admin/reports' element={<Report />} />
                    </Route>
                </ErrorBoundaryRoutes>
            </BasePathContext.Provider>

            <BasePathContext.Provider value='#/personal'>
                <ErrorBoundaryRoutes>
                    <Route path='personal/group' element={<Group />} />
                    <Route path='personal/group/:groupName' element={<GroupDetail />} />
                    <Route path='personal/dataset' element={<Dataset />} />
                    <Route path='personal/dataset/create' element={<DatasetCreate />} />
                    <Route path='personal/dataset/:type/:scope/:name/edit' element={<DatasetUpdate />} />
                    <Route path='personal/dataset/:type/:scope/:name' element={<DatasetDetail />} />
                    <Route path='personal/notebook' element={<Notebook />} />
                    <Route path='personal/notebook/create' element={<NotebookCreate />} />
                    <Route path='personal/notebook/:name' element={<NotebookDetail />} />
                    <Route
                        path='personal/notebook/:name/edit'
                        element={<NotebookCreate update={true} />}
                    />
                    {applicationConfig.configuration.EnabledServices.realtimeTranslate ? (
                        <Route path='personal/translate/realtime' element={<TranslateRealtime />} />
                    ) : undefined}
                </ErrorBoundaryRoutes>
            </BasePathContext.Provider>
            
            <BasePathContext.Provider value='#/project'>
                <ErrorBoundaryRoutes>
                    {enableProjectCreation(applicationConfig.configuration.ProjectCreation.isAdminOnly, currentUser) ? (
                        <Route path='project/create' element={<ProjectCreate />} />
                    ) : undefined}
                    <Route path='project/:projectName' element={<ProjectDetail />} />
                    <Route path='project/:projectName/edit' element={<ProjectCreate isEdit={true} />} />
                    <Route path='project/:projectName/user' element={<ProjectUser />} />
                    <Route path='project/:projectName/groups' element={<ProjectGroups />} />
                    <Route path='project/:projectName/endpoint' element={<Endpoint />} />
                    <Route path='project/:projectName/endpoint/create' element={<EndpointCreate />} />
                    <Route path='project/:projectName/endpoint/:name' element={<EndpointDetails />} />
                    <Route path='project/:projectName/endpoint-config' element={<EndpointConfig />} />
                    <Route
                        path='project/:projectName/endpoint-config/create'
                        element={<EndpointConfigCreate />}
                    />
                    <Route
                        path='project/:projectName/endpoint-config/:name'
                        element={<EndpointConfigDetails />}
                    />
                    <Route path='project/:projectName/notebook' element={<Notebook />} />
                    <Route path='project/:projectName/notebook/create' element={<NotebookCreate />} />
                    <Route path='project/:projectName/notebook/:name' element={<NotebookDetail />} />
                    <Route
                        path='project/:projectName/notebook/:name/edit'
                        element={<NotebookCreate update={true} />}
                    />
                    <Route path='project/:projectName/dataset' element={<Dataset />} />
                    <Route path='project/:projectName/dataset/create' element={<DatasetCreate />} />
                    <Route
                        path='project/:projectName/dataset/:type/:scope/:name'
                        element={<DatasetDetail />}
                    />
                    <Route
                        path='project/:projectName/dataset/:type/:scope/:name/edit'
                        element={<DatasetUpdate />}
                    />
                    <Route path='project/:projectName/model' element={<Model />} />
                    <Route path='project/:projectName/model/create' element={<ModelCreate />} />
                    <Route path='project/:projectName/model/:modelName' element={<ModelDetail />} />

                    {applicationConfig.configuration.EnabledServices.labelingJob ? (
                        <Route
                            path='project/:projectName/jobs/labeling/*'
                            element={<LabelingJobRoutes />}
                        />
                    ) : undefined}

                    <Route
                        path='project/:projectName/jobs/training/*'
                        element={<TrainingJobRoutes />}
                    />
                    <Route path='project/:projectName/jobs/hpo/*' element={<HPOJobRoutes />} />
                    <Route
                        path='project/:projectName/jobs/transform/*'
                        element={<TransformJobRoutes />}
                    />

                    {applicationConfig.configuration.EnabledServices.emrCluster ? (
                        <>
                            <Route path='project/:projectName/emr' element={<EMRClusters />} />

                            <Route path='project/:projectName/emr/create' element={<EMRClusterCreate />} />
                            <Route
                                path='project/:projectName/emr/:clusterId/:clusterName'
                                element={<EMRDetail />}
                            />
                        </>
                    ) : undefined}
                    {applicationConfig.configuration.EnabledServices.batchTranslate ? (
                        <>
                            <Route
                                path='project/:projectName/batch-translate'
                                element={<BatchTranslate />}
                            />

                            <Route
                                path='project/:projectName/batch-translate/create'
                                element={<BatchTranslateCreate />}
                            />
                            <Route
                                path='project/:projectName/batch-translate/:jobId'
                                element={<BatchTranslateDetail />}
                            />
                        </>
                    ) : undefined}
                    {/* <Route path='*' element={<ResourceNotFound />} /> */}
                </ErrorBoundaryRoutes>
            </BasePathContext.Provider>
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
