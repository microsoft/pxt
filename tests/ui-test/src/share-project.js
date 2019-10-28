import { DomObject } from './lib/dom-object';
import assert from "assert";
let { shareTheProject } = require('./lib/css-value');

class ShareProject extends DomObject {

    async shareProject() {

        await this.click(shareTheProject.shareButton);

        let publishIconText = await this.getText(shareTheProject.titleOfPublishButton);

        console.debug(`The name of publish project button is: "${publishIconText}"`);

        assert.equal(publishIconText, 'Publish project');

        let sharedProjectName = await this.getAttribute(shareTheProject.shareName, "value");

        console.debug(`The shared project's name is: "${sharedProjectName}"`);

        assert.equal(sharedProjectName, "Project1");

        await this.click(shareTheProject.publishButton, shareTheProject.copyButton, shareTheProject.closeButtonOfSharePage);

    }

    test() {

        it('Share Project', async () => {
            return await this.shareProject();
        });
    }
}
export let shareProject = new ShareProject();