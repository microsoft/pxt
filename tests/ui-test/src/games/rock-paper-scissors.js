import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { games, commonActions} = require('../lib/css-value');

class RockPaperScissors extends DomObject {

    async rockPaperScissors() {

        await this.click(games.rockPaperScissors, commonActions.closeButton,
            games.rockPaperScissors, commonActions.startTutorial);
        
        let headerTitle = await this.getText(commonActions.headerTitle);
        assert.equal(headerTitle, 'Rock Paper Scissors');
        console.debug(`The title of the current window is "${headerTitle}"`);
       
        await this.click(commonActions.okButton);

        for (let i = 1; i < 11; i++) {

            await this.click(commonActions.goNextButton);
            let cssValueOfSelectLabel = await this.getAttribute(commonActions.selectedLabel, 'class');
            assert.equal(cssValueOfSelectLabel, 'ui circular label blue selected ');

            let selectLabel = await this.getAttribute(commonActions.selectedLabel, 'aria-label');
            console.log(selectLabel);
        }

        await this.click(commonActions.finishButton);

        let projectName = await this.getAttribute(commonActions.projectName, 'value');
        assert.equal(projectName, 'Rock Paper Scissors');
        console.debug(`The current project name is "${projectName}"`);
    
        await this.click(commonActions.microbitLogo);

    }

    test() {
        it('Start learning the Rock Paper Scissors', async () => {
            return await this.rockPaperScissors();
        });
    }

}
export let rockPaperScissors = new RockPaperScissors();