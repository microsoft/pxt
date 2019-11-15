import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { games, commonActions } = require('../lib/css-value');

class SnapTheDot extends DomObject {

    async snapTheDot() {

        await this.click(games.snapTheDot, commonActions.closeButton,
            games.snapTheDot, commonActions.startTutorial); 
       
        let headerTitle = await this.getText(commonActions.headerTitle);
        assert.equal(headerTitle, 'Snap the Dot');
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
        assert.equal(projectName, 'Snap the dot');
        console.debug(`The current project name is "${projectName}"`);
        
        await this.click(commonActions.microbitLogo, commonActions.seeMoreOfGames);

    }

    test() {
        it('Start learning the Snap The Dot', async () => {
            return await this.snapTheDot();
        });
    }

}
export let snapTheDot = new SnapTheDot();