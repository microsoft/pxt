import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { tutorials } = require('../lib/css-value');

class RedLightGreenLight extends DomObject {

    async redLightGreenLight() {

        await this.click(tutorials.redLightGreenLight, tutorials.closeButton,
            tutorials.redLightGreenLight, tutorials.showInstructions);

        await this.switchToNewWindow();

        let headerTitle = await this.getText(tutorials.titleOfRedLightGreenLight);
        assert.equal(headerTitle, 'Red Light Green Light');
        console.debug(`The header of the new page is "${headerTitle}"`);

        await this.closeCurrentWindow();
        
        await this.click(tutorials.closeButton);

    }

    test() {
        it('Start learning the Red Light Green Light', async () => {
            return await this.redLightGreenLight();
        });
    }

}
export let redLightGreenLight = new RedLightGreenLight();