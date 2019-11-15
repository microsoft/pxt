import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { radioGames, commonActions } = require('../lib/css-value');

class VotingMachine extends DomObject {

    async votingMachine() {

        await this.click(radioGames.votingMachine, commonActions.closeButton,
            radioGames.votingMachine, commonActions.showInstructions);

        await this.switchToNewWindow();

        let headerTitle = await this.getText(radioGames.titleOfVotingMachine);
        assert.equal(headerTitle, 'Voting Machine');
        console.debug(`The title of the current page is "${headerTitle}"`);

        await this.click(commonActions.playButton);

        await this.switchToIframe('.embed iframe');

        await this.click(commonActions.videoPlay);

        let videoTitle = await this.getText(commonActions.videoTitle);
        assert.equal(videoTitle, 'micro:bit voting machine');
        console.debug(`The video title is "${videoTitle}"`);

        await this.closeCurrentWindow();

        await this.click(commonActions.closeButton);

    }

    test() {
        it('Start learning the "Voting Machine"', async () => {
            return await this.votingMachine();
        });
    }

}
export let votingMachine = new VotingMachine();