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

import React, { RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@cloudscape-design/components';
import { IAppConfiguration } from '../../shared/model/app.configuration.model';
import { useAppSelector } from '../../config/store';
import { appConfig } from '../configuration/configuration-reducer';
import Condition from '../../modules/condition';
import { enableProjectCreation } from '../../shared/util/permission-utils';
import { selectCurrentUser } from '../user/user.reducer';

export type ActionItem = {
    text: string;
    id: string;
};

function ProjectCreateButton (createButtonHref: RefObject<HTMLInputElement>) {
    const navigate = useNavigate();
    const applicationConfig: IAppConfiguration = useAppSelector(appConfig);
    const currentUser = useAppSelector(selectCurrentUser);
    

    return (
        <Condition condition={enableProjectCreation(applicationConfig.configuration.ProjectCreation.isAdminOnly, currentUser)}>
            <Button
                variant='primary'
                onClick={() => navigate('/project/create')}
                ref={createButtonHref}
            >
                Create Project
            </Button>
        </Condition>
    );
}

export { ProjectCreateButton };
