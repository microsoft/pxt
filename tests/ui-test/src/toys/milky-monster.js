import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { toys, commonActions } = require('../lib/css-value');

class MilkMonster extends DomObject {

    async milkMonster() {

        await this.click(toys.milkMonster, commonActions.closeButton,
            toys.milkMonster, commonActions.showInstructions);

        await this.switchToNewWindow();

        let headerTitle = await this.getText(toys.titleOfMilkMonster);
        assert.equal(headerTitle, 'Milk Monster');
        console.debug(`The header of the new page is "${headerTitle}"`);
        
        // await this.click(commonActions.getStartButton);

        await this.click(commonActions.playButton);

        await this.switchToIframe('.embed iframe');

        await this.click(commonActions.videoPlay);

        let videoTitle = await this.getText(commonActions.videoTitle);
        assert.equal(videoTitle, '19 run monster run');
        console.debug(`The video title is "${videoTitle}"`);

        await this.closeCurrentWindow();
        
        await this.click(commonActions.closeButton);

    }

    test() {
        it('Start learning the "Milk Monster"', async () => {
            return await this.milkMonster();
        });
    }

}
export let milkMonster = new MilkMonster();