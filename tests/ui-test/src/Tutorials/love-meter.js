import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { tutorials } = require('../lib/css-value');

class LoveMeter extends DomObject {

    async loveMeter() {

        await this.click(tutorials.loveMeter, tutorials.closeButton,
            tutorials.loveMeter, tutorials.startTutorial);

        let headerTitle = await this.getText(tutorials.headerTitle);
        assert.equal(headerTitle, 'Love Meter');
        console.debug(`The title of the current window is "${headerTitle}"`);

        await this.click(tutorials.okButton);

        for (let i = 1; i < 5; i++) {

            await this.click(tutorials.goNextButton);
            let cssValueOfSelectLabel = await this.getAttribute(tutorials.selectedLabel, 'class');
            assert.equal(cssValueOfSelectLabel, 'ui circular label blue selected ');

            let selectLabel = await this.getAttribute(tutorials.selectedLabel, 'aria-label');
            console.log(selectLabel);
        }

        await this.click(tutorials.finishButton);

        let projectName = await this.getAttribute(tutorials.projectName, 'value');
        assert.equal(projectName, 'Love Meter');
        console.debug(`The current project name is "${projectName}"`);

        await this.click(tutorials.microbitLogo, tutorials.seeMoreOfTutorials);

    }

    test() {
        it('Start learning the Love Meter', async () => {
            return await this.loveMeter();
        });
    }

}
export let loveMeter = new LoveMeter();