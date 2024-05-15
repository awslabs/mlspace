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

import { SystemBanner } from './system-banner';
import { colorNameToRgb } from '../../shared/util/color-utils';

const bannerText = 'This is a text banner';
const textColor = 'white';
const backgroundColor = 'green';

it('Mounting the system banner', () => {
    // Set necessary window environment varialbes - don't need to be mocked since this is a simulated browser
    cy.window().then((win) => {
        win.env = {
            SYSTEM_BANNER: {
                backgroundColor: backgroundColor,
                fontColor: textColor,
                text: bannerText
            }
        };
    });

    // Mount the banners
    cy.mount(
        <div>
            <SystemBanner position='BOTTOM'/>
            <SystemBanner position='TOP'/>
        </div>
    );

    // Test a bottom-mounted banner
    cy.contains(bannerText);
    cy.get('#bottomBanner')
        .should('include.text', bannerText)
        .and('have.css', 'color', colorNameToRgb(textColor))
        .and('have.css', 'background-color', colorNameToRgb(backgroundColor))
        .then(($target) => {
            // Testing coordinates of elements with expected locations
            const coords = $target[0].getBoundingClientRect();
            expect(coords.left).to.equal(0);
            expect(coords.bottom).to.equal(Cypress.config('viewportHeight'));
        });

    // Test a top-mounted banner
    cy.contains(bannerText);
    cy.get('#topBanner')
        .should('include.text', bannerText)
        .and('have.css', 'color', colorNameToRgb(textColor))
        .and('have.css', 'background-color', colorNameToRgb(backgroundColor))
        .then(($target) => {
            const coords = $target[0].getBoundingClientRect();
            expect(coords.left).to.equal(0);
            expect(coords.top).to.equal(0);
        });
});