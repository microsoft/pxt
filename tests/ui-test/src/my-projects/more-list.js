import { DomObject } from '../lib/dom-object';
import assert from 'assert';
let { moreOfProject } = require('../lib/css-value');

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
                
                assert.equal(projectName, 'Project1');
                
                console.debug(`This is the name of the new project at the time:${projectName}`);

                await this.sendKeys(moreOfProject.nameInputBoxInSettings, 'Fortest');

                await this.click(moreOfProject.saveButtonInSettings);
            }
            if (i == 3) {

                await this.click(moreOfProject.editSettingsAsTextButton);
            }
        }
        await this.click(moreOfProject.moreButton, moreOfProject.extensionsOption);

        let extensionHeader = await this.getText(moreOfProject.FirstExtensionTitle);
        
        assert.equal(extensionHeader, 'bluetooth');
        
        console.debug(`This is the first extension name:${extensionHeader}`);

        await this.click(moreOfProject.goBackButtonInExtensions, moreOfProject.moreButton, moreOfProject.deleteOption);

        let deleteTitle = await this.getText(moreOfProject.titleOfDeleteAlert);
        
        assert.equal(deleteTitle, "Would you like to delete 'Fortest'?");
        
        console.debug(`This is the alert of delete project:${deleteTitle}`);

        await this.click(moreOfProject.cancelButton, moreOfProject.moreButton, moreOfProject.reportAbuse,
            moreOfProject.cancelButton, moreOfProject.moreButton, moreOfProject.languageOption);

        let languageHeader = await this.getText(moreOfProject.headerTitle);
        
        assert.equal(languageHeader, 'Select Language');
        
        console.debug(`This is the header-title of language:${languageHeader}`);

        await this.click(moreOfProject.closeButton, moreOfProject.moreButton, moreOfProject.turnOnTheHighContrast);

        await this.catchScreenShot('HighContrast');

        await this.click(moreOfProject.moreButton, moreOfProject.turnOnTheGreenScreen);

        let headerTitle = await this.getText(moreOfProject.headerTitle);
        
        assert.equal(headerTitle, 'Choose a camera');

        console.debug(`This is the header-title of choosing a screen background:${headerTitle}`);

        let cameraName = await this.getText(moreOfProject.nameOfCamera);
        
        assert.equal(cameraName, 'Green background');
        
        console.debug(`This is the camera name:${cameraName}`);

        await this.click(moreOfProject.chooseTheGreenBackGround);

        await this.catchScreenShot('GreenBackground');

        await this.click(moreOfProject.moreButton, moreOfProject.pairDevice);

        let pairDeviceTitle = await this.getText(moreOfProject.headerTitle);
        
        assert.equal(pairDeviceTitle, 'Pair device for one-click downloads');
        
        console.log(pairDeviceTitle);

        await this.click(moreOfProject.closeButton, moreOfProject.moreButton, moreOfProject.aboutOption, moreOfProject.okButtonOfAbout);

        await this.click(moreOfProject.moreButton, moreOfProject.resetOption);

        let resetMessage = await this.getText(moreOfProject.textOfReset);
       
        assert.equal(resetMessage, 'You are about to clear all projects. Are you sure? This operation cannot be undone.');

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