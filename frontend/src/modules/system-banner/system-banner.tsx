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

import { TextContent } from '@cloudscape-design/components';
import { appConfig } from '../../entities/configuration/configuration-reducer';
import { useAppSelector } from '../../config/store';
import React from 'react';
import { IAppConfiguration } from '../../shared/model/app.configuration.model';

type BannerOptions = {
    position: 'TOP' | 'BOTTOM';
};

export const SystemBanner = ({ position }: BannerOptions) => {
    const applicationConfig: IAppConfiguration = useAppSelector(appConfig);

    if (applicationConfig.configuration.SystemBanner.isEnabled) {
        document.getElementById('root')!.style.paddingTop = '1.5em';
    }
    
    const bannerStyle: React.CSSProperties = {
        width: '100%',
        position: 'fixed',
        left: '0px',
        zIndex: 4999,
        textAlign: 'center',
        padding: '2px 0px',
        backgroundColor: applicationConfig.configuration.SystemBanner.backgroundColor,
        color: applicationConfig.configuration.SystemBanner.textColor,
    };

    if (position === 'TOP') {
        bannerStyle.top = 0;
    } else {
        bannerStyle.bottom = 0;
    }

    return (
        <TextContent>
            <div style={bannerStyle} id={position === 'TOP' ? 'topBanner' : 'bottomBanner'}>
                <span>{applicationConfig.configuration.SystemBanner.text}</span>
            </div>
        </TextContent>
    );
};

export default SystemBanner;
