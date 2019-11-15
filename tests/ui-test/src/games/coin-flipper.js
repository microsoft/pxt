import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { games, commonActions } = require('../lib/css-value');

class CoinFlipper extends DomObject {

    async coinFlipper() {

        await this.click(games.coinFlipper, commonActions.closeButton,
            games.coinFlipper, commonActions.startTutorial);

        let headerTitle = await this.getText(commonActions.headerTitle);
        assert.equal(headerTitle, 'Coin Flipper');
        console.debug(`The title of the current window is "${headerTitle}"`);
    
        await this.click(commonActions.okButton);

        for (let i = 1; i < 7; i++) {

            await this.click(commonActions.goNextButton);
            let cssValueOfSelectLabel = await this.getAttribute(commonActions.selectedLabel, 'class');
            assert.equal(cssValueOfSelectLabel, 'ui circular label blue selected ');

            let selectLabel = await this.getAttribute(commonActions.selectedLabel, 'aria-label');
            console.log(selectLabel);
        }

        await this.click(commonActions.finishButton);

        let projectName = await this.getAttribute(commonActions.projectName, 'value');
        assert.equal(projectName, 'Coin Flipper');
        console.debug(`The current project name is "${projectName}"`);

        await this.click(commonActions.microbitLogo);

    }

    test() {
        it('Start learning the Coin Flipper', async () => {
            return await this.coinFlipper();
        });
    }

}
export let coinFlipper = new CoinFlipper();