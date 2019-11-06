import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { tutorials } = require('../lib/css-value');

class FlashingHeart extends DomObject {

    async flashingHeart() {

        await this.click(tutorials.flashingHeart, tutorials.closeButton,
            tutorials.flashingHeart, tutorials.startTutorialButton);

        let headerTitle = await this.getText(tutorials.headerTitle);
        assert.equal(headerTitle, 'Flashing Heart');
        console.debug(`The title of the current window is "${headerTitle}"`);

        await this.click(tutorials.okButton);

        for (let i = 1; i < 4; i++) {

            await this.click(tutorials.goNextButton);
            let cssValueOfSelectLabel = await this.getAttribute(tutorials.selectedLabel, 'class');
            assert.equal(cssValueOfSelectLabel, 'ui circular label blue selected ');

            let selectLabel = await this.getAttribute(tutorials.selectedLabel, 'aria-label');
            console.log(selectLabel);
        }

        await this.click(tutorials.finishButton, tutorials.microbitLogo);
        await this.click(tutorials.prograss)

        let projectName = await this.getAttribute(tutorials.projectName, 'value');
        assert.equal(projectName, 'Flashing Heart');
        console.debug(`The current project name is "${projectName}"`);

        await this.click(tutorials.microbitLogo);

    }

    test() {
        it('Start learning the flashing heart', async () => {
            return await this.flashingHeart();
        });
    }

}
export let flashingHeart = new FlashingHeart();