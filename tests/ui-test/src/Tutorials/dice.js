import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { tutorials,commonActions } = require('../lib/css-value');

class Dice extends DomObject {

    async dice() {

        await this.click(tutorials.dice, commonActions.closeButton,
            tutorials.dice, commonActions.startTutorial);

        let headerTitle = await this.getText(commonActions.headerTitle);
        assert.equal(headerTitle, 'Dice');
        console.debug(`The title of the current window is "${headerTitle}"`);
        
        await this.click(commonActions.okButton);

        for (let i = 1; i < 6; i++) {

            await this.click(commonActions.goNextButton);
            let cssValueOfSelectLabel = await this.getAttribute(commonActions.selectedLabel, 'class');
            assert.equal(cssValueOfSelectLabel, 'ui circular label blue selected ');

            let selectLabel = await this.getAttribute(commonActions.selectedLabel, 'aria-label');
            console.log(selectLabel);
        }

        await this.click(commonActions.finishButton);

        let projectName = await this.getAttribute(commonActions.projectName, 'value');
        assert.equal(projectName, 'Dice');
        console.debug(`The current project name is "${projectName}"`);
    
        await this.click(commonActions.microbitLogo, commonActions.seeMoreOfTutorials);

    }

    test() {
        it('Start learning the Dice', async () => {
            return await this.dice();
        });
    }

}
export let dice = new Dice();