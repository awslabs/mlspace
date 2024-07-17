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

import { ExpandableSection, ExpandableSectionProps } from '@cloudscape-design/components';
import React, { useEffect, useRef, useState } from 'react';

function NotificationExpandableSection (props: ExpandableSectionProps) {
    const [expanded, setExpanded] = useState(props.expanded || props.defaultExpanded || false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        ref?.current?.focus();
    }, [ref]);

    return (
        <div onKeyDown={(event) => {
            console.log(event.code);
            switch (event.code) {
                case 'ArrowLeft': // left arrow
                    setExpanded(false);
                    break;
                case 'ArrowRight': // right arrow
                    setExpanded(true);
                    break;
                case 'Enter': // return
                case 'Space': // space
                    setExpanded(!expanded);
                    break;
            }
        }} tabIndex={0} ref={ref}>
            <ExpandableSection {...props} expanded={expanded} onChange={({detail}) => setExpanded(detail.expanded)}>
                {props.children}
            </ExpandableSection>
        </div>
    );
}

export default NotificationExpandableSection;