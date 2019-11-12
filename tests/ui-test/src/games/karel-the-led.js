import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { tutorials } = require('../lib/css-value');

class KarelTheLed extends DomObject {

    async karelTheLed() {

        await this.click(tutorials.karelTheLed, tutorials.closeButton,
            tutorials.karelTheLed, tutorials.showInstructions);

        await this.switchToNewWindow();

        let headerTitle = await this.getText(tutorials.titleOfKarelTheLed);
        assert.equal(headerTitle, 'Karel the LED');
        console.debug(`The title of the current page is "${headerTitle}"`);

        await this.closeCurrentWindow();

        await this.click(tutorials.closeButton);

    }

    test() {
        it('Start learning the Karel the LED', async () => {
            return await this.karelTheLed();
        });
    }

}
export let karelTheLed = new KarelTheLed();