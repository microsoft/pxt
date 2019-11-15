import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { radioGames, commonActions } = require('../lib/css-value');

class Infection extends DomObject {

    async infection() {

        await this.click(radioGames.infection, commonActions.closeButton,
            radioGames.infection, commonActions.showInstructions);

        await this.switchToNewWindow();

        try {

            let headerTitle = await this.getText(radioGames.titleOfInfection);
            assert.equal(headerTitle, 'Infection');
            console.debug(`The title of the current page is "${headerTitle}"`);

            await this.click(commonActions.playButton);

            await this.switchToIframe('.embed iframe');

            await this.click(commonActions.videoPlay);

            let videoTitle = await this.getText(commonActions.videoTitle);
            assert.equal(videoTitle, 'Behind the MakeCode Hardware - Radio in micro:bit');
            console.debug(`The video title is "${videoTitle}"`);

        } catch (error) {

            console.error(error);

        }

        await this.closeCurrentWindow();

        await this.click(commonActions.closeButton);

    }

    test() {
        it('Start learning the "Infection"', async () => {
            return await this.infection();
        });
    }

}
export let infection = new Infection();