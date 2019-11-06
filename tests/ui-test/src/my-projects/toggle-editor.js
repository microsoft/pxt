import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { switchButton } = require('../lib/css-value');

class ToggleDisplayForm extends DomObject {

    async toggleDisplayForm() {

        console.debug("Start testToggleDisplayForm()");

        await this.click(switchButton.switchToJavaScript);

        let explorerToolbar = await this.getText(switchButton.titleOfExplorer);

        assert.equal(explorerToolbar, 'Explorer');

        console.debug(`The ${explorerToolbar} toolbar appears after toggling to JavaScript option`);

        await this.click(switchButton.switchToBlocks);

    }

    test() {
        it('Toggle to Blocks or JavaScript', async () => {

            return await this.toggleDisplayForm();

        });
    }
}

export let toggleDisplayForm = new ToggleDisplayForm();


