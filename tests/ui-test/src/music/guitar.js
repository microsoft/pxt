import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { music, commonActions } = require('../lib/css-value');

class Guitar extends DomObject {

    async guitar() {

        await this.click(music.guitar, commonActions.closeButton,
            music.guitar, commonActions.showInstructions);

        await this.switchToNewWindow();

        let headerTitle = await this.getText(music.titleOfGuitar);
        assert.equal(headerTitle, 'Guitar');
        console.debug(`The header of the new page is "${headerTitle}"`);
        
        // await this.click(commonActions.getStartButton);

        await this.click(commonActions.playButton);

        await this.switchToIframe('.embed iframe');

        await this.click(commonActions.videoPlay);

        let videoTitle = await this.getText(commonActions.videoTitle);
        assert.equal(videoTitle, 'micro:bit guitar - build your own guitar!');
        console.debug(`The video title is "${videoTitle}"`);

        await this.closeCurrentWindow();
        
        await this.click(commonActions.closeButton);

    }

    test() {
        it('Start learning the "Guitar"', async () => {
            return await this.guitar();
        });
    }

}
export let guitar = new Guitar();