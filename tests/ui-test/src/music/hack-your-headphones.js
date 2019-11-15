import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { music, commonActions } = require('../lib/css-value');

class HackYourHeadphones extends DomObject {

    async hackYourHeadphones() {

        await this.click(music.hackYourHeadphones, commonActions.closeButton,
            music.hackYourHeadphones, commonActions.showInstructions);

        await this.switchToNewWindow();

        let headerTitle = await this.getText(music.titleOfHeadphones);
        assert.equal(headerTitle, 'Hack Your Headphones');
        console.debug(`The header of the new page is "${headerTitle}"`);
        
        // await this.click(commonActions.getStartButton);

        await this.closeCurrentWindow();
        
        await this.click(commonActions.closeButton);

    }

    test() {
        it('Start learning the "Hack Your Headphones"', async () => {
            return await this.hackYourHeadphones();
        });
    }

}
export let hackYourHeadphones = new HackYourHeadphones();