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

import { AppLayout, BreadcrumbGroup, BreadcrumbGroupProps } from '@cloudscape-design/components';
import { HashRouter } from 'react-router-dom';
import AppRoutes from './routes';
import ErrorBoundary from './shared/error/error-boundary';
import SideNavigation from './shared/layout/navigation/side-navigation';

import React from 'react';
import { useAuth } from 'react-oidc-context';
import { useAppSelector } from './config/store';
import DeleteModal, { DeleteModalProps } from './modules/modal/delete-modal';
import ResourceScheduleModal, {
    ResourceScheduleModalProps,
} from './modules/modal/resource-schedule-modal';
import UpdateModal, { UpdateModalProps } from './modules/modal/update-modal';
import SystemBanner from './modules/system-banner';
import Header from './shared/layout/header/header';
import NotificationBanner from './shared/layout/notification/notification';
import { applyTheme } from '@cloudscape-design/components/theming';

const baseHref = document?.querySelector('base')?.getAttribute('href')?.replace(/\/$/, '');

export default function App () {
    const modal: DeleteModalProps = useAppSelector((state) => state.modal.deleteModal);
    const updateModal: UpdateModalProps = useAppSelector((state) => state.modal.updateModal);
    const resourceScheduleModal: ResourceScheduleModalProps = useAppSelector(
        (state) => state.modal.resourceScheduleModal
    );
    const breadcrumbs: BreadcrumbGroupProps.Item[] = useAppSelector(
        (state) => state.navigation.breadcrumbs
    );
    const auth = useAuth();

    // Applies custom theming from public/theming.js
    applyTheme(window.custom_theme);

    return (
        <HashRouter basename={baseHref}>
            <ErrorBoundary>
                { window.env.SYSTEM_BANNER?.text && <SystemBanner position='TOP' /> }
                <AppLayout
                    ariaLabels={{
                        navigation: 'Console',
                        navigationClose: 'Close console',
                        navigationToggle: 'Open console',
                        notifications: 'Notifications',
                        tools: 'Help panel',
                        toolsClose: 'Close help panel',
                        toolsToggle: 'Open help panel',
                    }}
                    contentHeader={<Header />}
                    headerSelector='#topBanner'
                    footerSelector='#bottomBanner'
                    navigationHide={!auth.isAuthenticated}
                    navigation={<SideNavigation />}
                    content={<AppRoutes />}
                    notifications={<NotificationBanner />}
                    stickyNotifications={true}
                    toolsHide={true}
                    breadcrumbs={<BreadcrumbGroup items={breadcrumbs} ariaLabel='Breadcrumbs' />}
                />
                { window.env.SYSTEM_BANNER?.text && <SystemBanner position='BOTTOM' /> }
                {modal && <DeleteModal {...modal} />}
                {updateModal && <UpdateModal {...updateModal} />}
                {resourceScheduleModal && <ResourceScheduleModal {...resourceScheduleModal} />}
            </ErrorBoundary>
        </HashRouter>
    );
}
