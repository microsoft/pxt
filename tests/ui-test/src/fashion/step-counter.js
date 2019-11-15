import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { fashion, commonActions } = require('../lib/css-value');

class StepCounter extends DomObject {

    async stepCounter() {

        await this.click(fashion.stepCounter, commonActions.closeButton,
            fashion.stepCounter, commonActions.showInstructions);

        await this.switchToIframe(commonActions.idOfIframe);

        let headerTitle = await this.getText(fashion.titleOfStepCounter);
        assert.equal(headerTitle, 'Step Counter');
        console.debug(`The header of the sidedocs is "${headerTitle}"`);
        
        await this.switchToDefaultFrame();

        await this.click(commonActions.openInNewTab);

        await this.switchToNewWindow();

        await this.closeCurrentWindow();
        
        await this.click(commonActions.microbitLogo);

    }

    test() {
        it('Start learning the "Step counter"', async () => {
            return await this.stepCounter();
        });
    }

}
export let stepCounter = new StepCounter();