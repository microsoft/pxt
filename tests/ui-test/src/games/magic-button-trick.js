import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { tutorials } = require('../lib/css-value');

class MagicButtonTrick extends DomObject {

    async magicButtonTrick() {

        await this.click(tutorials.magicButtonTrick, tutorials.closeButton,
            tutorials.magicButtonTrick, tutorials.showInstructions);

        await this.switchToNewWindow();
         
        let headerTitle = await this.getText(tutorials.titleOfMagic);
        assert.equal(headerTitle, 'Magic Button Trick');
        console.debug(`The title of the current page is "${headerTitle}"`);

        await this.click(tutorials.playButton);

        await this.switchToIframe('.embed iframe');

        await this.click(tutorials.videoPlay);

        let videoTitle = await this.getText(tutorials.videoTitle);
        assert.equal(videoTitle, 'microbit magic button trick demo');
        console.debug(`The video title is "${videoTitle}"`); 

        await this.closeCurrentWindow();

        await this.click(tutorials.closeButton);

    }

    test() {
        it('Start learning the Magic Button Trick', async () => {
            return await this.magicButtonTrick();
        });
    }

}
export let magicButtonTrick = new MagicButtonTrick();