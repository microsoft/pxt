import { DomObject } from './lib/dom-object';
import assert from "assert";
let { switchButton } = require('./lib/css-value');

class ToggleButton extends DomObject {

    async toggleDisplayForm() {

        console.debug("Start testToggleDisplayForm()");

        await this.click(switchButton.toggleToJavaScript);

        let explorerToolbar = await this.getText(switchButton.titleOfExplorer);

        assert.equal(explorerToolbar, 'Explorer');

        console.debug(`The ${explorerToolbar} toolbar appears after toggling to JavaScript option`);

        await this.click(switchButton.toggleToBlocks);

    }

    test() {
        it('Toggle to Blocks or JavaScript', async () => {

            return await this.toggleDisplayForm();

        });
    }
}

export let toggleButton = new ToggleButton();


