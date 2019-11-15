import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { tutorials, commonActions } = require('../lib/css-value');

class SmileyButtons extends DomObject {

    async smileyButtons() {

        await this.click(tutorials.smileyButtons, commonActions.closeButton,
            tutorials.smileyButtons, commonActions.startTutorial);
        
        let headerTitle = await this.getText(commonActions.headerTitle);
        assert.equal(headerTitle, 'Smiley Buttons');
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
        assert.equal(projectName, 'Smiley Buttons');
        console.debug(`The current project name is "${projectName}"`);

        await this.click(commonActions.microbitLogo);

    }

    test() {
        it('Start learning the smiley buttons', async () => {
            return await this.smileyButtons();
        });
    }

}
export let smileyButtons = new SmileyButtons();