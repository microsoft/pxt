import { DomObject } from './lib/dom-object';
import assert from 'assert';

class GetMoreList extends DomObject {

    async moreList() {
        for (let i = 1; i < 4; i++) {

            await this.click('[title="More..."]', '[title="Project Settings"]');

            if (i == 1) {
                await this.click('[title="Go back"]');
            }
            if (i == 2) {

                let projectName = await this.getAttribute('#fileNameInput', "value");

                console.debug(`This is the name of the new project at the time:${projectName}`);

                assert.equal(projectName, 'Project1');

                await this.sendKeys('#fileNameInput', 'Fortest');

                await this.click('.ui.button.green');
            }
            if (i == 3) {

                await this.click('.field .ui.button:nth-child(2)');
            }
        }
        await this.click('[title="More..."]', '[title="Extensions"]');

        let extensionHeader = await this.getText('.ui.card.link:nth-child(1) .header');

        console.debug(`This is the first extension name:${extensionHeader}`);

        assert.equal(extensionHeader, 'bluetooth');

        await this.click('.header-close [title="Go back"]', '[title="More..."]', '[title="Delete Project"]');

        let deleteTitle = await this.getText('.header-title');

        console.debug(`This is the alert of delete project:${deleteTitle}`);

        assert.equal(deleteTitle, "Would you like to delete 'Project1Fortest'?");

        await this.click('button.cancel', '[title="More..."]', '[title="Report Abuse..."]', 'button.cancel', '[title="More..."]', '[title="Language"]');

        let languageHeader = await this.getText('.header-title');

        console.debug(`This is the header-title of language:${languageHeader}`);

        assert.equal(languageHeader, 'Select Language');

        await this.click('.closeIcon', '[title="More..."]', '[title="More..."] .ui:nth-child(8)');

        await this.catchScreenShot('HighContrast');

        await this.click('[title="More..."]', '[title="Green Screen On"]');

        let headerTitle = await this.getText('.header-title');

        console.debug(`This is the header-title of choosing a screen background:${headerTitle}`);

        assert.equal(headerTitle, 'Choose a camera');

        let cameraName = await this.getText('.ui.card.link .header');

        console.debug(`This is the camera name:${cameraName}`);

        assert.equal(cameraName, 'Green background');

        await this.click('.massive');

        await this.catchScreenShot('GreenBackground');

        await this.click('[title="More..."]', '[title="Pair device"]');

        let pairDeviceTitle = await this.getText('.header-title');

        console.log(pairDeviceTitle);

        await this.click('.closeIcon', '[title="More..."]', '[title="About..."]', '.positive');

        await this.click('[title="More..."]', '[title="Reset"]');

        let resetMessage = await this.getText('.dimmed .content p');

        console.log(resetMessage);

        await this.click('.actions .red');
    }

    test() {
        it('Get More.. List', async () => {
            return await this.moreList();
        });
    }
}

export let getMoreList = new GetMoreList();