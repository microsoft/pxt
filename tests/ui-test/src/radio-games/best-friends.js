import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { radioGames, commonActions } = require('../lib/css-value');

class BestFriends extends DomObject {

    async bestFriends() {

        await this.click(radioGames.bestFriends, commonActions.closeButton,
            radioGames.bestFriends, commonActions.showInstructions);

        await this.switchToNewWindow();

        let headerTitle = await this.getText(radioGames.titleOfBestFriends);
        assert.equal(headerTitle, 'Best Friends');
        console.debug(`The header of the new page is "${headerTitle}"`);

        await this.closeCurrentWindow();

        await this.click(commonActions.closeButton);

    }

    test() {
        it('Start learning the "Best Friends"', async () => {
            return await this.bestFriends();
        });
    }

}
export let bestFriends = new BestFriends();