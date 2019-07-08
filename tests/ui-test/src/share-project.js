import { DomObject } from './lib/dom-object';

import assert from "assert";


class ShareProject extends DomObject {

    async shareProject() {

        await this.click('.shareproject');

        let publishIconText = await this.getText('.sharedialog .actions .ui.text');

        console.debug(`The name of publish project button is: "${publishIconText}"`);

        assert.equal(publishIconText, 'Publish project');

        let sharedProjectName = await this.getInputValue("#projectNameInput");

        console.debug(`The shared project's name is: "${sharedProjectName}"`);

        assert.equal(sharedProjectName, "Project1");

        await this.click('.labeled.primary', '.field i.icon', '.closeIcon');

        return true;
    }

    test() {

        it('Share Project', async () => {
            return await this.shareProject();
        });
    }
}
export let shareProject = new ShareProject();