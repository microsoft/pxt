import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { games, commonActions } = require('../lib/css-value');

class ReactionTime extends DomObject {

    async reactionTime() {

        await this.click(games.reactionTime, commonActions.closeButton,
            games.reactionTime, commonActions.showInstructions);

        await this.switchToNewWindow();
        
        let headerTitle = await this.getText(games.titleOfReactionTime);
        assert.equal(headerTitle, 'Reaction Time');
        console.debug(`The title of the current page is "${headerTitle}"`);

        await this.click(commonActions.playButton);

        await this.switchToIframe('.embed iframe');

        await this.click(commonActions.videoPlay);
    
        let videoTitle = await this.getText(commonActions.videoTitle);
        assert.equal(videoTitle, 'micro:bit reaction game');
        console.debug(`The video title is "${videoTitle}"`);
        
        await this.closeCurrentWindow();

        await this.click(commonActions.closeButton);

    }

    test() {
        it('Start learning the Reaction Time', async () => {
            return await this.reactionTime();
        });
    }

}
export let reactionTime = new ReactionTime();