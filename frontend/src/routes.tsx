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
import React, { useEffect, useMemo, useRef } from 'react';
import {
    setAdminItems,
    setBreadcrumbs,
} from './shared/layout/navigation/navigation.reducer';
import { useAppDispatch, useAppSelector } from './config/store';
import EntitiesRoutes from './entities/routes';
import Home from './shared/layout/home/home';
import { hasAuthParams, useAuth } from 'react-oidc-context';
import Condition from './modules/condition';
import { Button, ColumnLayout, Container, SpaceBetween } from '@cloudscape-design/components';
import { getCurrentUser, selectCurrentUser, setCurrentUser } from './entities/user/user.reducer';
import { hasPermission } from './shared/util/permission-utils';
import { Permission } from './shared/model/user.model';
import { applyMode } from '@cloudscape-design/global-styles';
import keyLogo  from './shared/media/key.png';
import groupLogo  from './shared/media/group.png';
import docsLogo  from './shared/media/docs.png';
import './routes.css';
import NotificationService from './shared/layout/notification/notification.service';
import { failedToLoadConfig, getConfiguration } from './entities/configuration/configuration-reducer';

export default function AppRoutes () {
    const auth = useAuth();
    const currentUser = useAppSelector(selectCurrentUser);
    const dispatch = useAppDispatch();
    const notificationService = NotificationService(dispatch);
    const notifiedError = useRef(false);
    const configLoadError: boolean = useAppSelector(failedToLoadConfig);

    useEffect(() => {
        if (hasAuthParams() || auth.isAuthenticated || auth.activeNavigator || auth.isLoading) {
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

    useMemo(() => {
        dispatch(getConfiguration({configScope: 'global'}));
        if (configLoadError) {
            notificationService.generateNotification(
                'Error loading app configuration. Restrictive default policy has been applied in its place. Consult with system admin to resolve issue.',
                'error'
            );
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        currentUser,
        configLoadError,
        dispatch,
    ]);

    /**
     * Alerts a notification if the user failed to connect to the authentication service
     *
     * This should only occur when the redirect is not properly configured
     */
    useEffect(() => {
        if (auth.error && !notifiedError.current){
            notifiedError.current = true;
            notificationService.generateNotification('Failed to connect to the authentication service', 'error');
        }
        notifiedError.current = false;

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [auth.error]);

    return (
        <div className='view-routes'>
            <Condition condition={!auth.isAuthenticated && !auth.isLoading}>
                <Routes>
                    <Route
                        path='*'
                        element={
                            <SpaceBetween size={'xxl'} direction='vertical'>
                                <h1 className='landing-page-header'>
                                        Welcome to {window.env.APPLICATION_NAME}
                                </h1>
                                <p className='landing-page-description'>{window.env.APPLICATION_NAME} is an open source, web based, data science environment. Through {window.env.APPLICATION_NAME}&apos;s accessible portal, users leverage the power of Amazon SageMaker, a fully managed machine learning service, without needing individual AWS Accounts. {window.env.APPLICATION_NAME} allows data science teams to collaboratively build, train, and deploy machine learning models.</p>
                                <ColumnLayout columns={3}>
                                    <Container
                                        className='landing-page-card'
                                        media={{
                                            content: (<img src={groupLogo} alt='Icon of a group' />),
                                            height: 200,
                                            position: 'top'
                                        }}>
                                        <h2>Request Access</h2>
                                        <p>To access {window.env.APPLICATION_NAME}, request an account from your {window.env.APPLICATION_NAME} administrator.</p>
                                    </Container>
                                    <Container
                                        className='landing-page-card'
                                        media={{
                                            content: (<img src={keyLogo} alt='Icon of a key' />),
                                            height: 200,
                                            position: 'top'
                                        }}>
                                        <h2 className='landing-page-card-title'>
                                            Login To Get Started
                                        </h2>
                                        <p>Click below to sign into your {window.env.APPLICATION_NAME} account.</p>
                                        <Button
                                            className='landing-page-card-button'
                                            variant='primary'
                                            onClick={() => {
                                                auth.signinRedirect();
                                            }}>
                                                Login
                                        </Button>
                                    </Container>
                                    <Container
                                        className='landing-page-card'
                                        media={{
                                            content: (<img src={docsLogo} alt='Icon of reading a document' />),
                                            height: 200,
                                            position: 'top'
                                        }}>
                                        <h2>Read The Docs</h2>
                                        <p>Consult {window.env.APPLICATION_NAME}&apos;s documentation to learn more.</p>
                                        <Button
                                            className='landing-page-card-button'
                                            variant='primary'
                                            iconName='external'
                                            href={`${window.env.LAMBDA_ENDPOINT}/docs/index.html`}
                                            target='_blank'
                                        >
                                            Documentation
                                        </Button>


                                    </Container>
                                </ColumnLayout>
                            </SpaceBetween>
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
