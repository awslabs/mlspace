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