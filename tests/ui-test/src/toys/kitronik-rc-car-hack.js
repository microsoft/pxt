import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { toys, commonActions } = require('../lib/css-value');

class KitronikRCCarHack extends DomObject {

    async KitronikRCCarHack() {

        await this.click(toys.kitronikRCCarHack, commonActions.closeButton,
            toys.kitronikRCCarHack, commonActions.showInstructions);

        await this.switchToNewWindow();

        let headerTitle = await this.getText(toys.titleOfRCCar);
        assert.equal(headerTitle, 'RC Car');
        console.debug(`The header of the new page is "${headerTitle}"`);
        
        // await this.click(commonActions.getStartButton);

        await this.click(commonActions.playButton);

        await this.switchToIframe('.embed iframe');

        await this.click(commonActions.videoPlay);

        let videoTitle = await this.getText(commonActions.videoTitle);
        assert.equal(videoTitle, 'micro:bit Monster car');
        console.debug(`The video title is "${videoTitle}"`);

        await this.closeCurrentWindow();
        
        await this.click(commonActions.closeButton);

    }

    test() {
        it('Start learning the "Kitronik RC Car Hack"', async () => {
            return await this.KitronikRCCarHack();
        });
    }

}
export let kitronikRCCarHack = new KitronikRCCarHack();