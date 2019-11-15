import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { radioGames, commonActions } = require('../lib/css-value');

class TelePotato extends DomObject {

    async telePotato() {

        await this.click(radioGames.telePotato, commonActions.closeButton,
            radioGames.telePotato, commonActions.showInstructions);

        await driver.sleep(3000);
        await this.switchToIframe(commonActions.idOfIframe);

        try {

            let headerTitle = await this.getText(radioGames.titleOfTelePotato);
            assert.equal(headerTitle, 'Tele-Potato');
            console.debug(`The header of the sidedocs is "${headerTitle}"`);

        } catch (error) {

            console.error(error);

        }

        await this.switchToDefaultFrame();

        await this.click(commonActions.microbitLogo);
    }

    test() {
        it('Start learning the Tele-Potato', async () => {
            return await this.telePotato();
        });
    }

}
export let telePotato = new TelePotato();