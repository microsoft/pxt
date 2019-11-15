import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { tools, commonActions } = require('../lib/css-value');

class LightLevelMeter extends DomObject {

    async lightLevelMeter() {

        await this.click(tools.lightLevelMeter, commonActions.closeButton,
            tools.lightLevelMeter, commonActions.showInstructions);

        await this.switchToIframe(commonActions.idOfIframe);

        let headerTitle = await this.getText(tools.titleOfLightLevelMeter);
        assert.equal(headerTitle, 'Light Level Meter');
        console.debug(`The header of the sidedocs is "${headerTitle}"`);
        
        await this.click(commonActions.openInNewTab);

        await this.closeCurrentWindow();
        
        await this.click(commonActions.microbitLogo);

    }

    test() {
        it('Start learning the "Light Level Meter"', async () => {
            return await this.lightLevelMeter();
        });
    }

}
export let lightLevelMeter = new LightLevelMeter();