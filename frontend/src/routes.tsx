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

import { Route, Routes } from 'react-router-dom';
import ErrorBoundaryRoutes from './shared/error/error-boundary-routes';
import React, { useEffect } from 'react';
import {
    setAdminItems,
    setBreadcrumbs,
} from './shared/layout/navigation/navigation.reducer';
import { useAppDispatch, useAppSelector } from './config/store';
import EntitiesRoutes from './entities/routes';
import Home from './shared/layout/home/home';
import { hasAuthParams, useAuth } from 'react-oidc-context';
import Condition from './modules/condition';
import { Button, Container } from '@cloudscape-design/components';
import { getCurrentUser, selectCurrentUser, setCurrentUser } from './entities/user/user.reducer';
import { hasPermission } from './shared/util/permission-utils';
import { Permission } from './shared/model/user.model';
import { applyMode } from '@cloudscape-design/global-styles';

export default function AppRoutes () {
    const auth = useAuth();
    const currentUser = useAppSelector(selectCurrentUser);
    const dispatch = useAppDispatch();

    useEffect(() => {
        if (!hasAuthParams() && !auth.isAuthenticated && !auth.activeNavigator && !auth.isLoading) {
            auth.signinRedirect({ redirect_uri: window.location.toString() });
        } else {
            getCurrentUser()
                .then((response) => {
                    if (response.status === 200) {
                        const { data } = response;
                        const isAdmin = hasPermission(Permission.ADMIN, data.permissions);
                        dispatch(setAdminItems(isAdmin));
                        dispatch(setCurrentUser(data));
                        if (data.preferences?.displayMode) {
                            applyMode(data.preferences.displayMode);
                        }
                    }
                })
                .catch(() => {
                    // If we failed to get the current user it's likely because we're
                    // in the middle of authenticating. The auth object will update and
                    // we'll attempt this call again.
                });
        }
        dispatch(setBreadcrumbs([]));
    }, [
        dispatch,
        auth,
        auth.isAuthenticated,
        auth.activeNavigator,
        auth.isLoading,
        auth.signinRedirect,
    ]);

    return (
        <div className='view-routes'>
            <Condition condition={!auth.isLoading && !auth.isAuthenticated}>
                <Routes>
                    <Route
                        path='*'
                        element={
                            <Container>
                                <h1>Authentication Required</h1>

                                <p>
                                    This application requires that you first authenticate using an
                                    external authenticator before accessing the application.
                                </p>

                                <p>
                                    <Button onClick={() => auth.signinRedirect()}>Login</Button>
                                </p>
                            </Container>
                        }
                    />
                </Routes>
            </Condition>

            <Condition condition={auth.isAuthenticated && currentUser.suspended!}>
                <Routes>
                    <Route
                        path='*'
                        element={
                            <Container>
                                <h1>Account is suspended</h1>

                                <p>
                                    Your account is in a suspended state. While suspended, you will
                                    not have access to {window.env.APPLICATION_NAME}. Contact your system administrator to
                                    have your account reinstated.
                                </p>
                            </Container>
                        }
                    />
                </Routes>
            </Condition>

            <Condition condition={auth.isAuthenticated && !currentUser.suspended}>
                <ErrorBoundaryRoutes>
                    <Route index element={<Home />} />
                    <Route path='*' element={<EntitiesRoutes />} />
                </ErrorBoundaryRoutes>
            </Condition>
        </div>
    );
}
