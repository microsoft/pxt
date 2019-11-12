import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { tutorials } = require('../lib/css-value');

class Infection extends DomObject {

    async infection() {

        await this.click(tutorials.infection, tutorials.closeButton,
            tutorials.infection, tutorials.showInstructions);

        await this.switchToNewWindow();

        try {

            let headerTitle = await this.getText(tutorials.titleOfInfection);
            assert.equal(headerTitle, 'Infection');
            console.debug(`The title of the current page is "${headerTitle}"`);

            await this.click(tutorials.playButton);

            await this.switchToIframe('.embed iframe');

            await this.click(tutorials.videoPlay);

            let videoTitle = await this.getText(tutorials.videoTitle);
            assert.equal(videoTitle, 'Behind the MakeCode Hardware - Radio in micro:bit');
            console.debug(`The video title is "${videoTitle}"`);

        } catch (error) {
            
            console.error(error);
            
        }
        
        await this.closeCurrentWindow();

        await this.click(tutorials.closeButton);

    }

    test() {
        it('Start learning the "Infection"', async () => {
            return await this.infection();
        });
    }

}
export let infection = new Infection();