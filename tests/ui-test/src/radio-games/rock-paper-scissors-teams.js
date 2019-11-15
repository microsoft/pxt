import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { radioGames, commonActions } = require('../lib/css-value');

class RockPaperScissorsTeams extends DomObject {

    async rockPaperScissorsTeams() {

        await this.click(radioGames.rockPaperScissorsTeams, commonActions.closeButton,
            radioGames.rockPaperScissorsTeams, commonActions.showInstructions);

        await this.switchToNewWindow();

        let headerTitle = await this.getText(radioGames.titleOfRockPaperScissorsTeams);
        assert.equal(headerTitle, 'Rock Paper Scissors Teams');
        console.debug(`The title of the current page is "${headerTitle}"`);

        await this.click(commonActions.playButton);

        await this.switchToIframe('.embed iframe');

        await this.click(commonActions.videoPlay);

        let videoTitle = await this.getText(commonActions.videoTitle);
        assert.equal(videoTitle, 'micro:bit rock paper scissors teams');
        console.debug(`The video title is "${videoTitle}"`);

        await this.closeCurrentWindow();

        await this.click(commonActions.closeButton);

    }

    test() {
        it('Start learning the "Rock Paper Scissors Teams"', async () => {
            return await this.rockPaperScissorsTeams();
        });
    }

}
export let rockPaperScissorsTeams = new RockPaperScissorsTeams();