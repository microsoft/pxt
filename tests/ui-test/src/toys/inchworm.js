import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { toys, commonActions } = require('../lib/css-value');

class Inchworm extends DomObject {

    async inchworm() {

        await this.click(toys.inchworm, commonActions.closeButton,
            toys.inchworm, commonActions.showInstructions);

        await this.switchToNewWindow();

        let headerTitle = await this.getText(toys.titleOfInchworm);
        assert.equal(headerTitle, 'Inchworm');
        console.debug(`The header of the new page is "${headerTitle}"`);
        
        // await this.click(commonActions.getStartButton);

        await this.click(commonActions.playButton);

        await this.switchToIframe('.embed iframe');

        await this.click(commonActions.videoPlay);

        let videoTitle = await this.getText(commonActions.videoTitle);
        assert.equal(videoTitle, 'micro:bit - inchworm robot');
        console.debug(`The video title is "${videoTitle}"`);

        await this.closeCurrentWindow();
        
        await this.click(commonActions.closeButton);

    }

    test() {
        it('Start learning the "Inchworm"', async () => {
            return await this.inchworm();
        });
    }

}
export let inchworm = new Inchworm();