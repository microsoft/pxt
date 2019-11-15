import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { tutorials, commonActions} = require('../lib/css-value');

class MicroChat extends DomObject {

    async microChat() {

        await this.click(tutorials.microChat, commonActions.closeButton,
            tutorials.microChat, commonActions.startTutorial);

        let headerTitle = await this.getText(commonActions.headerTitle);
        assert.equal(headerTitle, 'Micro Chat');
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
        assert.equal(projectName, 'Micro Chat');
        console.debug(`The current project name is "${projectName}"`);

        await this.click(commonActions.microbitLogo);

    }

    test() {
        it('Start learning the Micro Chat', async () => {
            return await this.microChat();
        });
    }

}
export let microChat = new MicroChat();