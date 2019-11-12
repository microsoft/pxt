import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { tutorials } = require('../lib/css-value');

class TelePotato extends DomObject {

    async telePotato() {

        await this.click(tutorials.telePotato, tutorials.closeButton,
            tutorials.telePotato, tutorials.showInstructions);

        await driver.sleep(3000);
        await this.switchToIframe('#sidedocsframe');

        try{

            let headerTitle = await this.getText(tutorials.titleOfTelePotato);
            assert.equal(headerTitle, 'Tele-Potato');
            console.debug(`The header of the sidedocs is "${headerTitle}"`);

        }catch(error){

            console.error(error);
            
        }
        

        await this.switchToDefaultFrame();

        await this.click(tutorials.microbitLogo);

    }

    test() {
        it('Start learning the Tele-Potato', async () => {
            return await this.telePotato();
        });
    }

}
export let telePotato = new TelePotato();