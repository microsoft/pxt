import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { radioGames, commonActions } = require('../lib/css-value');

class FireFlies extends DomObject {

    async fireFlies() {

        await this.click(radioGames.fireFlies, commonActions.closeButton,
            radioGames.fireFlies, commonActions.showInstructions);

        await this.switchToNewWindow();

        let headerTitle = await this.getText(radioGames.titleOfFireflies);
        assert.equal(headerTitle, 'Fireflies');
        console.debug(`The title of the current page is "${headerTitle}"`);

        await this.click(commonActions.playButton);

        await this.switchToIframe('.embed iframe');

        await this.click(commonActions.videoPlay);

        let videoTitle = await this.getText(commonActions.videoTitle);
        assert.equal(videoTitle, 'Synchronizing Fireflies');
        console.debug(`The video title is "${videoTitle}"`);

        await this.closeCurrentWindow();

        await this.click(commonActions.closeButton);

    }

    test() {
        it('Start learning the Fireflies', async () => {
            return await this.fireFlies();
        });
    }

}
export let fireFlies = new FireFlies();