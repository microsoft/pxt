import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { fashion, commonActions } = require('../lib/css-value');

class DuctTapeWatch extends DomObject {

    async ductTapeWatch() {

        await this.click(fashion.ductTapeWatch, commonActions.closeButton,
            fashion.ductTapeWatch, commonActions.showInstructions);

        await this.switchToNewWindow();

        let headerTitle = await this.getText(fashion.titleOfDuctTapeWatch);
        assert.equal(headerTitle, 'Duct Tape Watch');
        console.debug(`The header of the new page is "${headerTitle}"`);
        
        await this.closeCurrentWindow();
        
        await this.click(commonActions.closeButton);

    }

    test() {
        it('Start learning the "Duct Tape Watch"', async () => {
            return await this.ductTapeWatch();
        });
    }

}
export let ductTapeWatch = new DuctTapeWatch();