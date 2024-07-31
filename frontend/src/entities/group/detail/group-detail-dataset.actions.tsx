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

import { Button, Icon, SpaceBetween } from '@cloudscape-design/components';
import { useGetGroupDatasetsQuery } from '../group.reducer';
import React from 'react';
import { useParams } from 'react-router-dom';

function GroupDetailDatasetActions () {
    const { groupName } = useParams();
    const { refetch: refetchGroupDatasets, isFetching: isFetchingGroupDatasets } = useGetGroupDatasetsQuery(groupName!);

    return (
        <SpaceBetween direction='horizontal' size='xs'>
            <Button
                onClick={refetchGroupDatasets}
                ariaLabel={'Refresh dataset list'}
                disabled={isFetchingGroupDatasets}
            >
                <Icon name='refresh'/>
            </Button>
        </SpaceBetween>
    );
}



export { GroupDetailDatasetActions };