import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { tutorials } = require('../lib/css-value');

class ReactionTime extends DomObject {

    async reactionTime() {

        await this.click(tutorials.reactionTime, tutorials.closeButton,
            tutorials.reactionTime, tutorials.showInstructions);

        await this.switchToNewWindow();
        
        let headerTitle = await this.getText(tutorials.titleOfReactionTime);
        assert.equal(headerTitle, 'Reaction Time');
        console.debug(`The title of the current page is "${headerTitle}"`);

        await this.click(tutorials.playButton);

        await this.switchToIframe('.embed iframe');

        await this.click(tutorials.videoPlay);
    
        let videoTitle = await this.getText(tutorials.videoTitle);
        assert.equal(videoTitle, 'micro:bit reaction game');
        console.debug(`The video title is "${videoTitle}"`);
        
        await this.closeCurrentWindow();

        await this.click(tutorials.closeButton);

    }

    test() {
        it('Start learning the Reaction Time', async () => {
            return await this.reactionTime();
        });
    }

}
export let reactionTime = new ReactionTime();