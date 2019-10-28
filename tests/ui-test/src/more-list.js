import { DomObject } from './lib/dom-object';
import assert from 'assert';
let { moreOfProject } = require('./lib/css-value');

class GetMoreList extends DomObject {

    async moreList() {

        console.debug('Start testMoreList()');

        for (let i = 1; i < 4; i++) {

            await this.click(moreOfProject.moreButton, moreOfProject.projectSettings);

            if (i == 1) {
                await this.click(moreOfProject.goBackButtonInSettings);
            }
            if (i == 2) {

                let projectName = await this.getAttribute(moreOfProject.nameInputBoxInSettings, "value");

                console.debug(`This is the name of the new project at the time:${projectName}`);

                assert.equal(projectName, 'Project1');

                await this.sendKeys(moreOfProject.nameInputBoxInSettings, 'Fortest');

                await this.click(moreOfProject.saveButtonInSettings);
            }
            if (i == 3) {

                await this.click(moreOfProject.editSettingsAsTextButton);
            }
        }
        await this.click(moreOfProject.moreButton, moreOfProject.extensionsOption);

        let extensionHeader = await this.getText(moreOfProject.FirstExtensionTitle);

        console.debug(`This is the first extension name:${extensionHeader}`);

        assert.equal(extensionHeader, 'bluetooth');

        await this.click(moreOfProject.goBackButtonInExtensions, moreOfProject.moreButton, moreOfProject.deleteOption);

        let deleteTitle = await this.getText(moreOfProject.titleOfDeleteAlert);

        console.debug(`This is the alert of delete project:${deleteTitle}`);

        assert.equal(deleteTitle, "Would you like to delete 'Project1Fortest'?");

        await this.click(moreOfProject.cancelButton, moreOfProject.moreButton, moreOfProject.reportAbuse,
            moreOfProject.cancelButton, moreOfProject.moreButton, moreOfProject.languageOption);

        let languageHeader = await this.getText(moreOfProject.headerTitle);

        console.debug(`This is the header-title of language:${languageHeader}`);

        assert.equal(languageHeader, 'Select Language');

        await this.click(moreOfProject.closeButtonOfLanguage, moreOfProject.moreButton, moreOfProject.turnOnTheHighContrast);

        await this.catchScreenShot('HighContrast');

        await this.click(moreOfProject.moreButton, moreOfProject.turnOnTheGreenScreen);

        let headerTitle = await this.getText(moreOfProject.headerTitle);

        console.debug(`This is the header-title of choosing a screen background:${headerTitle}`);

        assert.equal(headerTitle, 'Choose a camera');

        let cameraName = await this.getText(moreOfProject.nameOfCamera);

        console.debug(`This is the camera name:${cameraName}`);

        assert.equal(cameraName, 'Green background');

        await this.click(moreOfProject.chooseTheGreenBackGround);

        await this.catchScreenShot('GreenBackground');

        await this.click(moreOfProject.moreButton, moreOfProject.pairDevice);

        let pairDeviceTitle = await this.getText(moreOfProject.headerTitle);

        console.log(pairDeviceTitle);

        await this.click(moreOfProject.closeButton, moreOfProject.moreButton, moreOfProject.aboutOption, moreOfProject.okButtonOfAbout);

        await this.click(moreOfProject.moreButton, moreOfProject.resetOption);

        let resetMessage = await this.getText(moreOfProject.textOfReset);

        console.log(resetMessage);

        await this.click(moreOfProject.resetButton);
    }

    test() {
        it('Get More.. List', async () => {
            return await this.moreList();
        });
    }
}

export let getMoreList = new GetMoreList();