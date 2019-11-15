import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { toys, commonActions } = require('../lib/css-value');

class RailwayCrossing extends DomObject {

    async railwayCrossing() {

        await this.click(toys.railwayCrossing, commonActions.closeButton,
            toys.railwayCrossing, commonActions.showInstructions);

        await this.switchToNewWindow();

        let headerTitle = await this.getText(toys.titleOfRailwayCrossing);
        assert.equal(headerTitle, 'Railway Crossing');
        console.debug(`The header of the new page is "${headerTitle}"`);
        
        // await this.click(commonActions.getStartButton);

        await this.click(commonActions.playButton);

        await this.switchToIframe('.embed iframe');

        await this.click(commonActions.videoPlay);

        let videoTitle = await this.getText(commonActions.videoTitle);
        assert.equal(videoTitle, 'Railway crossing built with the micro:bit');
        console.debug(`The video title is "${videoTitle}"`);

        await this.closeCurrentWindow();
        
        await this.click(commonActions.closeButton);

    }

    test() {
        it('Start learning the "Railway Crossing"', async () => {
            return await this.railwayCrossing();
        });
    }

}
export let railwayCrossing = new RailwayCrossing();