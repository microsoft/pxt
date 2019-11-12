import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { tutorials } = require('../lib/css-value');

class SnapTheDot extends DomObject {

    async snapTheDot() {

        await this.click(tutorials.snapTheDot, tutorials.closeButton,
            tutorials.snapTheDot, tutorials.startTutorial); 
       
        let headerTitle = await this.getText(tutorials.headerTitle);
        assert.equal(headerTitle, 'Snap the Dot');
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
        assert.equal(projectName, 'Snap the dot');
        console.debug(`The current project name is "${projectName}"`);
        
        await this.click(tutorials.microbitLogo, tutorials.seeMoreOfGames);

    }

    test() {
        it('Start learning the Snap The Dot', async () => {
            return await this.snapTheDot();
        });
    }

}
export let snapTheDot = new SnapTheDot();