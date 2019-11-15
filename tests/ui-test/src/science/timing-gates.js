import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { science, commonActions } = require('../lib/css-value');

class TimingGates extends DomObject {

    async timingGates() {

        await this.click(science.timingGates, commonActions.closeButton,
            science.timingGates, commonActions.showInstructions);

        await this.switchToNewWindow();

        let headerTitle = await this.getText(science.titleOfTimingGates);
        assert.equal(headerTitle, 'Timing Gates');
        console.debug(`The header of the new page is "${headerTitle}"`);
        
        await this.closeCurrentWindow();
        
        await this.click(commonActions.closeButton);

    }

    test() {
        it('Start learning the "Timing Gates"', async () => {
            return await this.timingGates();
        });
    }

}
export let timingGates = new TimingGates();