import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { tutorials } = require('../lib/css-value');

class CoinFlipper extends DomObject {

    async coinFlipper() {

        await this.click(tutorials.coinFlipper, tutorials.closeButton,
            tutorials.coinFlipper, tutorials.startTutorial);

        let headerTitle = await this.getText(tutorials.headerTitle);
        assert.equal(headerTitle, 'Coin Flipper');
        console.debug(`The title of the current window is "${headerTitle}"`);
    
        await this.click(tutorials.okButton);

        for (let i = 1; i < 7; i++) {

            await this.click(tutorials.goNextButton);
            let cssValueOfSelectLabel = await this.getAttribute(tutorials.selectedLabel, 'class');
            assert.equal(cssValueOfSelectLabel, 'ui circular label blue selected ');

            let selectLabel = await this.getAttribute(tutorials.selectedLabel, 'aria-label');
            console.log(selectLabel);
        }

        await this.click(tutorials.finishButton);

        let projectName = await this.getAttribute(tutorials.projectName, 'value');
        assert.equal(projectName, 'Coin Flipper');
        console.debug(`The current project name is "${projectName}"`);

        await this.click(tutorials.microbitLogo);

    }

    test() {
        it('Start learning the Coin Flipper', async () => {
            return await this.coinFlipper();
        });
    }

}
export let coinFlipper = new CoinFlipper();