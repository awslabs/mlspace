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

import React, { useEffect } from 'react';
import { Box, Container, Grid, Header, Link } from '@cloudscape-design/components';
import { DocTitle } from '../../shared/doc';
import {
    setActiveHref,
    setBreadcrumbs,
    setItemsForProjectName,
} from '../../shared/layout/navigation/navigation.reducer';
import { useAppDispatch } from '../../config/store';
import { getBase } from '../../shared/util/breadcrumb-utils';
import Logo from '../../shared/layout/logo/logo';

export default function ResourceNotFound () {
    const dispatch = useAppDispatch();
    DocTitle('Not Found');

    useEffect(() => {
        dispatch(setItemsForProjectName());
        dispatch(setBreadcrumbs([getBase(undefined)]));
        dispatch(setActiveHref('/#'));
    }, [dispatch]);
    return (
        <Container>
            <Grid gridDefinition={[{ colspan: 3, offset: { xxs: 2 } }, { colspan: 4 }]}>
                <Logo height={240} width={240} />
                <div style={{ paddingTop: 70 }}>
                    <Header variant='h1'>Not Found</Header>
                    <Box variant='awsui-key-label'>
                        {' Can\'t find what you were looking for? We can\'t either.'}
                    </Box>
                    <Link
                        ariaLabel={`${window.env.APPLICATION_NAME} Home`}
                        href='/'
                    >
                        Home
                    </Link>
                </div>
            </Grid>
        </Container>
    );
}
