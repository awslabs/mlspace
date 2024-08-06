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
import React, { useEffect, useState } from 'react';
import { useAppDispatch } from '../../config/store';
import { setBreadcrumbs } from '../../shared/layout/navigation/navigation.reducer';
import { useParams } from 'react-router-dom';
import { getBase } from '../../shared/util/breadcrumb-utils';
import { Container, Header, Tabs } from '@cloudscape-design/components';
import Form from '@cloudscape-design/components/form';
import { DocTitle, scrollToPageHeader } from '../../shared/doc';
import { TranslateRealtimeText } from './translate-realtime.text';
import { TranslateRealtimeDocument } from './translate-realtime.document';
import ContentLayout from '../../shared/layout/content-layout';

export const TranslateRealtime = () => {
    DocTitle('Real-time translation');
    const { projectName } = useParams();
    const dispatch = useAppDispatch();
    const [activeTabId, setActiveTabId] = useState('1');

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                {
                    text: 'Real-time translation',
                    href: '#/personal/translate/text',
                },
            ])
        );
        scrollToPageHeader('h1', 'Real-time translation');
    }, [dispatch, projectName]);

    /**
     * This is the content for the Translate real-time page which includes tabs for text or document translation
     */
    return (
        <ContentLayout
            header={
                <Header
                    variant='h1'
                    description='Use real-time translations to deliver on-demand translation for text that you enter'
                >
                    Real-time translation
                </Header>
            }
        >
            <Container>
                <Form>
                    <Tabs
                        onChange={(e) => setActiveTabId(e.detail.activeTabId)}
                        activeTabId={activeTabId}
                        i18nStrings={{
                            scrollLeftAriaLabel: 'Scroll left',
                            scrollRightAriaLabel: 'Scroll right',
                        }}
                        tabs={[
                            {
                                label: 'Text',
                                id: '1',
                                content: <TranslateRealtimeText />,
                            },
                            {
                                label: 'Document',
                                id: '2',
                                content: <TranslateRealtimeDocument />,
                            },
                        ]}
                    />
                </Form>
            </Container>
        </ContentLayout>
    );
};

export default TranslateRealtime;
