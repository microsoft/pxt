import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { tutorials } = require('../lib/css-value');

class BestFriends extends DomObject {

    async bestFriends() {

        await this.click(tutorials.bestFriends, tutorials.closeButton,
            tutorials.bestFriends, tutorials.showInstructions);

        await this.switchToNewWindow();

        let headerTitle = await this.getText(tutorials.titleOfBestFriends);
        assert.equal(headerTitle, 'Best Friends');
        console.debug(`The header of the new page is "${headerTitle}"`);
        
        await this.closeCurrentWindow();
        
        await this.click(tutorials.closeButton);

    }

    test() {
        it('Start learning the "Best Friends"', async () => {
            return await this.bestFriends();
        });
    }

}
export let bestFriends = new BestFriends();