import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { games, commonActions } = require('../lib/css-value');

class KarelTheLed extends DomObject {

    async karelTheLed() {

        await this.click(games.karelTheLed, commonActions.closeButton,
            games.karelTheLed, commonActions.showInstructions);

        await this.switchToNewWindow();

        let headerTitle = await this.getText(games.titleOfKarelTheLed);
        assert.equal(headerTitle, 'Karel the LED');
        console.debug(`The title of the current page is "${headerTitle}"`);

        await this.closeCurrentWindow();

        await this.click(commonActions.closeButton);

    }

    test() {
        it('Start learning the Karel the LED', async () => {
            return await this.karelTheLed();
        });
    }

}
export let karelTheLed = new KarelTheLed();