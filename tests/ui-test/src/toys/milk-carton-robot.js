import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { toys, commonActions } = require('../lib/css-value');

class MilkCartonRobot extends DomObject {

    async milkCartonRobot() {

        await this.click(toys.milkCartonRobot, commonActions.closeButton,
            toys.milkCartonRobot, commonActions.showInstructions);

        await this.switchToNewWindow();

        let headerTitle = await this.getText(toys.titleOfMilkCartonRobot);
        assert.equal(headerTitle, 'Milk Carton Robot');
        console.debug(`The header of the new page is "${headerTitle}"`);
        
        // await this.click(commonActions.getStartButton);

        await this.click(commonActions.playButton);

        await this.switchToIframe('.embed iframe');

        await this.click(commonActions.videoPlay);

        let videoTitle = await this.getText(commonActions.videoTitle);
        assert.equal(videoTitle, 'micro:bit milk jar robot - demo');
        console.debug(`The video title is "${videoTitle}"`);

        await this.closeCurrentWindow();
        
        await this.click(commonActions.closeButton);

    }

    test() {
        it('Start learning the "Milk Carton Robot"', async () => {
            return await this.milkCartonRobot();
        });
    }

}
export let milkCartonRobot = new MilkCartonRobot();