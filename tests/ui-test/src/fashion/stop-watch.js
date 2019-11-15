import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { fashion, commonActions } = require('../lib/css-value');

class StopWatch extends DomObject {

    async stopWatch() {

        await this.click(fashion.stopWatch, commonActions.closeButton,
            fashion.stopWatch, commonActions.showInstructions);

        await this.switchToIframe(commonActions.idOfIframe);

        let headerTitle = await this.getText(fashion.titleOfStopWatch);
        assert.equal(headerTitle, 'Stopwatch');
        console.debug(`The header of the sidedocs is "${headerTitle}"`);
        
        await this.switchToDefaultFrame();
        await this.click(commonActions.openInNewTab);

        await this.switchToNewWindow();
        await this.closeCurrentWindow();
        
        await this.click(commonActions.microbitLogo);

    }

    test() {
        it('Start learning the "Stopwatch"', async () => {
            return await this.stopWatch();
        });
    }

}
export let stopWatch = new StopWatch();