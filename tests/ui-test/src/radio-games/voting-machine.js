import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { tutorials } = require('../lib/css-value');

class VotingMachine extends DomObject {

    async votingMachine() {

        await this.click(tutorials.votingMachine, tutorials.closeButton,
            tutorials.votingMachine, tutorials.showInstructions);

        await this.switchToNewWindow();

        let headerTitle = await this.getText(tutorials.titleOfVotingMachine);
        assert.equal(headerTitle, 'Voting Machine');
        console.debug(`The title of the current page is "${headerTitle}"`);

        await this.click(tutorials.playButton);

        await this.switchToIframe('.embed iframe');

        await this.click(tutorials.videoPlay);

        let videoTitle = await this.getText(tutorials.videoTitle);
        assert.equal(videoTitle, 'micro:bit voting machine');
        console.debug(`The video title is "${videoTitle}"`);
        
        await this.closeCurrentWindow();

        await this.click(tutorials.closeButton);

    }

    test() {
        it('Start learning the "Voting Machine"', async () => {
            return await this.votingMachine();
        });
    }

}
export let votingMachine = new VotingMachine();