import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { tutorials } = require('../lib/css-value');

class Salute extends DomObject {

    async salute() {

        await this.click(tutorials.salute, tutorials.closeButton,
            tutorials.salute, tutorials.showInstructions);

        await this.switchToNewWindow();
        
        try {
            let headerTitle = await this.getText(tutorials.titleOfSalute);
            assert.equal(headerTitle, 'Salute!');
            console.debug(`The title of the current page is "${headerTitle}"`);

            await this.click(tutorials.playButton);

            await this.switchToIframe('.embed iframe');
    
            await this.click(tutorials.videoPlay);

            let videoTitle = await this.getText(tutorials.videoTitle);
            assert.equal(videoTitle, 'How to Play Salute!');
            console.debug(`The video title is "${videoTitle}"`);

        } catch (error) {

            console.error(error);
            
        }
        
        await this.closeCurrentWindow();

        await this.click(tutorials.closeButton);

    }

    test() {
        it('Start learning the Salute!', async () => {
            return await this.salute();
        });
    }

}
export let salute = new Salute();