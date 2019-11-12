import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { tutorials } = require('../lib/css-value');

class MicroCoin extends DomObject {

    async microCoin() {

        await this.click(tutorials.microCoin, tutorials.closeButton,
            tutorials.microCoin, tutorials.showInstructions);

        await this.switchToNewWindow();

        let headerTitle = await this.getText(tutorials.titleOfMicroCoin);
        assert.equal(headerTitle, 'micro:coin');
        console.debug(`The header of the new page is "${headerTitle}"`);
    
        await this.closeCurrentWindow();
        
        await this.click(tutorials.closeButton);

    }

    test() {
        it('Start learning the micro:coin', async () => {
            return await this.microCoin();
        });
    }

}
export let microCoin = new MicroCoin();