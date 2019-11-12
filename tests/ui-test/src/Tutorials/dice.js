import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { tutorials } = require('../lib/css-value');

class Dice extends DomObject {

    async dice() {

        await this.click(tutorials.dice, tutorials.closeButton,
            tutorials.dice, tutorials.startTutorial);

        let headerTitle = await this.getText(tutorials.headerTitle);
        assert.equal(headerTitle, 'Dice');
        console.debug(`The title of the current window is "${headerTitle}"`);
        
        await this.click(tutorials.okButton);

        for (let i = 1; i < 6; i++) {

            await this.click(tutorials.goNextButton);
            let cssValueOfSelectLabel = await this.getAttribute(tutorials.selectedLabel, 'class');
            assert.equal(cssValueOfSelectLabel, 'ui circular label blue selected ');

            let selectLabel = await this.getAttribute(tutorials.selectedLabel, 'aria-label');
            console.log(selectLabel);
        }

        await this.click(tutorials.finishButton);

        let projectName = await this.getAttribute(tutorials.projectName, 'value');
        assert.equal(projectName, 'Dice');
        console.debug(`The current project name is "${projectName}"`);
    
        await this.click(tutorials.microbitLogo, tutorials.seeMoreOfTutorials);

    }

    test() {
        it('Start learning the Dice', async () => {
            return await this.dice();
        });
    }

}
export let dice = new Dice();