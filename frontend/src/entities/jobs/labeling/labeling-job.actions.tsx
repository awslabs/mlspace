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
import { Button, SpaceBetween } from '@cloudscape-design/components';
import { useNavigate, useParams } from 'react-router-dom';
import { CreateFocus } from '../types';

export default function LabelingJobActions (props?: any) {
    const createJobRef = props?.focusProps?.createJobRef;

    return (
        <SpaceBetween direction='horizontal' size='xs'>
            <CreateLabelingJob createJobRef={createJobRef} />
        </SpaceBetween>
    );
}

function CreateLabelingJob ({ createJobRef }: CreateFocus) {
    const navigate = useNavigate();
    const { projectName } = useParams();

    return (
        <Button
            variant='primary'
            ref={createJobRef}
            onClick={() => {
                navigate(`/project/${projectName}/jobs/labeling/create`);
            }}
        >
            Create new labeling job
        </Button>
    );
}
