import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { music, commonActions } = require('../lib/css-value');

class BananaKeyboard extends DomObject {

    async bananaKeyboard() {

        await this.click(music.bananaKeyboard, commonActions.closeButton,
            music.bananaKeyboard, commonActions.showInstructions);

        await this.switchToNewWindow();

        let headerTitle = await this.getText(music.titleOfkeyBoard);
        assert.equal(headerTitle, 'Banana Keyboard');
        console.debug(`The header of the new page is "${headerTitle}"`);
        
        // await this.click(commonActions.getStartButton);

        await this.closeCurrentWindow();
        
        await this.click(commonActions.closeButton);

    }

    test() {
        it('Start learning the "Banana Keyboard"', async () => {
            return await this.bananaKeyboard();
        });
    }

}
export let bananaKeyboard = new BananaKeyboard();