import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { tutorials } = require('../lib/css-value');

class MoodRadio extends DomObject {

    async moodRadio() {

        await this.click(tutorials.moodRadio, tutorials.closeButton,
            tutorials.moodRadio, tutorials.showInstructions);

        await this.switchToIframe('#sidedocsframe');
        try{
            let headerTitle = await this.getText(tutorials.titleOfMoodRadio);
            assert.equal(headerTitle, 'Mood Radio');
            console.debug(`The header of the sidedocs is "${headerTitle}"`);
        }catch(error){
            console.error(error);
        }
        
        await this.switchToDefaultFrame();

        await this.click(tutorials.microbitLogo);

    }

    test() {
        it('Start learning the Mood Radio', async () => {
            return await this.moodRadio();
        });
    }

}
export let moodRadio = new MoodRadio();