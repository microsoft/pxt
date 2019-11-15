import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { radioGames, commonActions } = require('../lib/css-value');

class RedLightGreenLight extends DomObject {

    async redLightGreenLight() {

        await this.click(radioGames.redLightGreenLight, commonActions.closeButton,
            radioGames.redLightGreenLight, commonActions.showInstructions);

        await this.switchToNewWindow();

        let headerTitle = await this.getText(radioGames.titleOfRedLightGreenLight);
        assert.equal(headerTitle, 'Red Light Green Light');
        console.debug(`The header of the new page is "${headerTitle}"`);

        await this.closeCurrentWindow();

        await this.click(commonActions.closeButton);

    }

    test() {
        it('Start learning the Red Light Green Light', async () => {
            return await this.redLightGreenLight();
        });
    }

}
export let redLightGreenLight = new RedLightGreenLight();