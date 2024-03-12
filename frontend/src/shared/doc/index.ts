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


export function DocTitle (title: string, resource_name?: string | undefined) {
    const serviceName = `${window.env.APPLICATION_NAME} - `;
    const docTitle =
        typeof resource_name !== 'undefined'
            ? serviceName.concat(title, resource_name)
            : serviceName.concat(title);
    document.title = docTitle;
}

export function scrollToPageHeader (headerTag?: string, resourceName?: string) {
    if (resourceName) {
        const nodeList = document.querySelectorAll(headerTag ? headerTag : 'h2');
        nodeList.forEach((key) => {
            if (key.firstElementChild?.innerHTML.includes(resourceName)) {
                // Non-interactable elements cannot receive focus unless tabIndex is set to -1
                (key as HTMLElement).setAttribute('tabIndex', '-1');
                (key as HTMLElement).focus();
            }
        });
    }

    window.onload = () => {
        document.querySelector(headerTag ? headerTag : 'h2')?.scrollIntoView();
    };
}
