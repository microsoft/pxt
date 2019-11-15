import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { tools, commonActions } = require('../lib/css-value');

class AnalogPinTester extends DomObject {

    async analogPinTester() {

        await this.click(tools.analogPinTester, commonActions.closeButton,
            tools.analogPinTester, commonActions.showInstructions);

        await this.switchToIframe(commonActions.idOfIframe);

        let headerTitle = await this.getText(tools.titleOfAnalogPinTester);
        assert.equal(headerTitle, 'Analog Pin Tester');
        console.debug(`The header of the sidedocs is "${headerTitle}"`);
        
        await this.click(commonActions.openInNewTab);

        await this.closeCurrentWindow();
        
        await this.click(commonActions.microbitLogo);

    }

    test() {
        it('Start learning the "Analog Pin Tester"', async () => {
            return await this.analogPinTester();
        });
    }

}
export let analogPinTester = new AnalogPinTester();