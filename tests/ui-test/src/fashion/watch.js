import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { fashion, commonActions } = require('../lib/css-value');

class Watch extends DomObject {

    async watch() {

        await this.click(fashion.watch, commonActions.closeButton,
            fashion.watch, commonActions.showInstructions);

        await this.switchToNewWindow();

        let headerTitle = await this.getText(fashion.titleOfWatch);
        assert.equal(headerTitle, 'The Watch');
        console.debug(`The header of the new page is "${headerTitle}"`);
        
        await this.click(commonActions.getStartButton);

        let newPageTitle = await this.getText(fashion.titleOfMakeWatch);
        assert.equal(newPageTitle, 'The Watch - Make');
        console.debug(`The title of the new page is "${newPageTitle}"`);

        await this.closeCurrentWindow();
        
        await this.click(commonActions.closeButton);

    }

    test() {
        it('Start learning the "Watch"', async () => {
            return await this.watch();
        });
    }

}
export let watch = new Watch();