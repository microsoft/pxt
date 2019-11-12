import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { tutorials } = require('../lib/css-value');

class MultiDice extends DomObject {

    async multiDice() {

        await this.click(tutorials.multiDice, tutorials.closeButton,
            tutorials.multiDice, tutorials.startTutorial);
            
        let headerTitle = await this.getText(tutorials.headerTitle);
        assert.equal(headerTitle, 'Multi Dice');
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
        assert.equal(projectName, 'Multi Dice');
        console.debug(`The current project name is "${projectName}"`);
        
        await this.click(tutorials.microbitLogo);

    }

    test() {
        it('Start learning the Multi Dice', async () => {
            return await this.multiDice();
        });
    }

}
export let multiDice = new MultiDice();