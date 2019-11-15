import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { toys, commonActions } = require('../lib/css-value');

class RotaryDialRadio extends DomObject {

    async rotaryDialRadio() {

        await this.click(toys.rotaryDialRadio, commonActions.closeButton,
            toys.rotaryDialRadio, commonActions.showInstructions);

        await this.switchToNewWindow();

        let headerTitle = await this.getText(toys.titleOfRotaryDialRadio);
        assert.equal(headerTitle, 'Rotary Dial Radio');
        console.debug(`The header of the new page is "${headerTitle}"`);
        
        // await this.click(commonActions.getStartButton);

        await this.closeCurrentWindow();
        
        await this.click(commonActions.closeButton);

    }

    test() {
        it('Start learning the "Rotary Dial Radio"', async () => {
            return await this.rotaryDialRadio();
        });
    }

}
export let rotaryDialRadio = new RotaryDialRadio();