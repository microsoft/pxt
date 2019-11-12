import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { tutorials } = require('../lib/css-value');

class CrashyBird extends DomObject {

    async crashyBird() {

        await this.click(tutorials.crashyBird, tutorials.closeButton,
            tutorials.crashyBird, tutorials.showInstructions);

        await this.switchToNewWindow();
        
        let headerTitle = await this.getText(tutorials.titleOfCrashyBird);
        assert.equal(headerTitle, 'Crashy Bird');
        console.debug(`The title of the current page is "${headerTitle}"`);

        await this.closeCurrentWindow();

        await this.click(tutorials.closeButton);

    }

    test() {
        it('Start learning the Crashy Bird', async () => {
            return await this.crashyBird();
        });
    }

}
export let crashyBird = new CrashyBird();