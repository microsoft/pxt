import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { shareTheProject } = require('../lib/css-value');

class ShareProject extends DomObject {

    async shareProject() {

        await this.click(shareTheProject.shareButton);

        let publishIconText = await this.getText(shareTheProject.titleOfPublishButton);

        assert.equal(publishIconText, 'Publish project');

        console.debug(`The name of publish project button is: "${publishIconText}"`);

        let sharedProjectName = await this.getAttribute(shareTheProject.shareName, "value");

        assert.equal(sharedProjectName, "Project1");

        console.debug(`The shared project's name is: "${sharedProjectName}"`);

        await this.click(shareTheProject.publishButton, shareTheProject.copyButton);

        let projectUrl = await this.getAttribute(shareTheProject.projectUrl, 'value');

        await this.click(shareTheProject.closeButtonOfSharePage);

        try {
            await this.toUrlNavigation(projectUrl);

            await this.catchScreenShot('shared project');

            await this.backNavigation();

        } catch (error) {
            console.log(error);
        }
    }

    test() {

        it('Share Project', async () => {
            return await this.shareProject();
        });
    }
}
export let shareProject = new ShareProject();