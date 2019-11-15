import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { radioGames, commonActions } = require('../lib/css-value');

class MicroCoin extends DomObject {

    async microCoin() {

        await this.click(radioGames.microCoin, commonActions.closeButton,
            radioGames.microCoin, commonActions.showInstructions);

        await this.switchToNewWindow();

        let headerTitle = await this.getText(radioGames.titleOfMicroCoin);
        assert.equal(headerTitle, 'micro:coin');
        console.debug(`The header of the new page is "${headerTitle}"`);

        await this.closeCurrentWindow();

        await this.click(commonActions.closeButton);

    }

    test() {
        it('Start learning the micro:coin', async () => {
            return await this.microCoin();
        });
    }

}
export let microCoin = new MicroCoin();