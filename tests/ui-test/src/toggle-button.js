
import { DomObject } from './lib/dom-object';

import assert from "assert";

class ToggleButton extends DomObject {

    async toggleDisplayForm() {

        console.debug("Start testToggleDisplayForm()");

        await this.click('[title="Convert code to JavaScript"]');
        assert.in
        await driver.sleep(2000);
        let explorerToolbar = await this.getText('[aria-label="File explorer toolbar"]');
        assert.equal(explorerToolbar, 'Explorer');
        console.debug(`The ${explorerToolbar} toolbar appears after toggling to JavaScript option`);

        await this.click('[title="Convert code to Blocks"]');

    }

    test() {
        it('Toggle to Blocks or JavaScript', async () => {

            return await this.toggleDisplayForm();

        });
    }
}

export let toggleButton = new ToggleButton();


