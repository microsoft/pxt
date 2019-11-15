import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { tutorials, commonActions } = require('../lib/css-value');

class NameTag extends DomObject {

    async nameTag() {

        await this.click(tutorials.nameTag, commonActions.closeButton,
            tutorials.nameTag, commonActions.startTutorial);

        let headerTitle = await this.getText(commonActions.headerTitle);
        assert.equal(headerTitle, 'Name Tag');
        console.debug(`The title of the current window is "${headerTitle}"`);
       
        await this.click(commonActions.okButton);

        for (let i = 1; i < 4; i++) {

            await this.click(commonActions.goNextButton);
            
            let cssValueOfSelectLabel = await this.getAttribute(commonActions.selectedLabel, 'class');
            assert.equal(cssValueOfSelectLabel, 'ui circular label blue selected ');

            let selectLabel = await this.getAttribute(commonActions.selectedLabel, 'aria-label');
            console.log(selectLabel);
        }

        await this.click(commonActions.okButton,commonActions.finishButton);

        let projectName = await this.getAttribute(commonActions.projectName, 'value');
        assert.equal(projectName, 'Name Tag');
        console.debug(`The current project name is "${projectName}"`);
    
        await this.click(commonActions.microbitLogo);

    }

    test() {
        it('Start learning the name tag', async () => {
            return await this.nameTag();
        });
    }

}
export let nameTag = new NameTag();