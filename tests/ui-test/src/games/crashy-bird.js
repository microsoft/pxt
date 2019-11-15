import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { games, commonActions } = require('../lib/css-value');

class CrashyBird extends DomObject {

    async crashyBird() {

        await this.click(games.crashyBird, commonActions.closeButton,
            games.crashyBird, commonActions.showInstructions);

        await this.switchToNewWindow();
        
        let headerTitle = await this.getText(games.titleOfCrashyBird);
        assert.equal(headerTitle, 'Crashy Bird');
        console.debug(`The title of the current page is "${headerTitle}"`);

        await this.closeCurrentWindow();

        await this.click(commonActions.closeButton);

    }

    test() {
        it('Start learning the Crashy Bird', async () => {
            return await this.crashyBird();
        });
    }

}
export let crashyBird = new CrashyBird();