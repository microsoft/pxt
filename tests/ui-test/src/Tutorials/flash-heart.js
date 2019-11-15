import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { tutorials, commonActions } = require('../lib/css-value');

class FlashingHeart extends DomObject {

    async flashingHeart() {

        await this.click(tutorials.flashingHeart, commonActions.closeButton,
            tutorials.flashingHeart, commonActions.startTutorial);

        let headerTitle = await this.getText(commonActions.headerTitle);
        assert.equal(headerTitle, 'Flashing Heart');
        console.debug(`The title of the current window is "${headerTitle}"`);
        
        await this.click(commonActions.okButton);

        for (let i = 1; i < 4; i++) {

            await this.click(commonActions.goNextButton);
            
            let cssValueOfSelectLabel = await this.getAttribute(commonActions.selectedLabel, 'class');
            assert.equal(cssValueOfSelectLabel, 'ui circular label blue selected ');

            let selectLabel = await this.getAttribute(commonActions.selectedLabel, 'aria-label');
            console.log(selectLabel);
        }

        await this.click(commonActions.finishButton);
       
        let projectName = await this.getAttribute(commonActions.projectName, 'value');
        assert.equal(projectName, 'Flashing Heart');
        console.debug(`The current project name is "${projectName}"`);
       
        await this.click(commonActions.microbitLogo);

    }

    test() {
        it('Start learning the flashing heart', async () => {
            return await this.flashingHeart();
        });
    }

}
export let flashingHeart = new FlashingHeart();