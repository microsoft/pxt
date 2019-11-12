import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { tutorials } = require('../lib/css-value');

class RockPaperScissorsTeams extends DomObject {

    async rockPaperScissorsTeams() {

        await this.click(tutorials.rockPaperScissorsTeams, tutorials.closeButton,
            tutorials.rockPaperScissorsTeams, tutorials.showInstructions);

        await this.switchToNewWindow();

        let headerTitle = await this.getText(tutorials.titleOfRockPaperScissorsTeams);
        assert.equal(headerTitle, 'Rock Paper Scissors Teams');
        console.debug(`The title of the current page is "${headerTitle}"`);

        await this.click(tutorials.playButton);

        await this.switchToIframe('.embed iframe');

        await this.click(tutorials.videoPlay);

        let videoTitle = await this.getText(tutorials.videoTitle);
        assert.equal(videoTitle, 'micro:bit rock paper scissors teams');
        console.debug(`The video title is "${videoTitle}"`);
        
        await this.closeCurrentWindow();

        await this.click(tutorials.closeButton);

    }

    test() {
        it('Start learning the "Rock Paper Scissors Teams"', async () => {
            return await this.rockPaperScissorsTeams();
        });
    }

}
export let rockPaperScissorsTeams = new RockPaperScissorsTeams();