import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { science, commonActions } = require('../lib/css-value');

class StatesOfMatter extends DomObject {

    async statesOfMatter() {

        await this.click(science.statesOfMatter, commonActions.closeButton,
            science.statesOfMatter, commonActions.showInstructions);

        await this.switchToNewWindow();

        let headerTitle = await this.getText(science.titleOfStatesOfMatter);
        assert.equal(headerTitle, 'States of Matter');
        console.debug(`The header of the new page is "${headerTitle}"`);
        
        // await this.click(commonActions.getStartButton);

        await this.click(commonActions.playButton);

        await this.switchToIframe('.embed iframe');

        await this.click(commonActions.videoPlay);

        let videoTitle = await this.getText(commonActions.videoTitle);
        assert.equal(videoTitle, 'micro:bit forms of matter');
        console.debug(`The video title is "${videoTitle}"`);

        await this.closeCurrentWindow();
        
        await this.click(commonActions.closeButton);

    }

    test() {
        it('Start learning the "States of Matter"', async () => {
            return await this.statesOfMatter();
        });
    }

}
export let statesOfMatter = new StatesOfMatter();