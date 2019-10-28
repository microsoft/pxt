import { DomObject } from './lib/dom-object';
import assert from 'assert';
let { helpOfProject } = require('./lib/css-value');

class GetHelpList extends DomObject {

    async helpList() {

        console.debug('Start testHelpList()');

        await this.click(helpOfProject.helpButton, helpOfProject.support);

        await this.switchToWindow();

        await this.click(helpOfProject.helpButton, helpOfProject.reference);

        await this.switchToIframe(helpOfProject.iframeOfSideDocs);

        let referenceTitle = await this.getText(helpOfProject.titleOfReferencePage);

        console.debug(`The side docs toggle text is: ${referenceTitle}`);

        assert.equal(referenceTitle, 'Reference');

        await this.switchToDefaultFrame();

        await this.click(helpOfProject.openLinkButton);

        await driver.sleep(2000);

        await this.switchToWindow();

        await this.click(helpOfProject.helpButton, helpOfProject.blocks);

        await this.switchToIframe(helpOfProject.iframeOfSideDocs);

        let blocksTitle = await this.getText(helpOfProject.titleOfBlocksPage);

        console.debug(`The side docs toggle text is: ${blocksTitle}`);

        assert.equal(blocksTitle, 'Blocks language');

        await this.switchToDefaultFrame();

        await this.click(helpOfProject.collapseButton);

        await this.click(helpOfProject.helpButton, helpOfProject.javascript);

        await this.switchToIframe(helpOfProject.iframeOfSideDocs);

        let javascriptTitle = await this.getText(helpOfProject.titleOfJavaScriptPage);

        console.debug(`The side docs toggle text is: ${javascriptTitle}`);

        assert.equal(javascriptTitle, 'JavaScript');

        await this.switchToDefaultFrame();

        await this.click(helpOfProject.helpButton, helpOfProject.hardware);

        await this.switchToIframe(helpOfProject.iframeOfSideDocs);

        await this.click(helpOfProject.goBackButton);

        let goBackResult = await this.getText(helpOfProject.titleAfterGoBack);

        assert.notEqual(goBackResult, 'Device');

        await this.switchToDefaultFrame();

        await this.click(helpOfProject.helpButton, helpOfProject.buy);

        await this.switchToWindow();
    }

    test() {
        it('Get Help List', async () => {
            return await this.helpList();
        });
    }
}

export let getHelpList = new GetHelpList();
