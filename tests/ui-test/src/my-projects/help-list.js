import { DomObject } from '../lib/dom-object';
import assert from 'assert';
let { helpOfProject, commonActions } = require('../lib/css-value');

class GetHelpList extends DomObject {

    async helpList() {

        console.debug('Start testHelpList()');

        await this.click(helpOfProject.helpButton, helpOfProject.support);

        await this.switchToNewWindow();

        let titleOfSupport = await this.getText(helpOfProject.headerTitleOfSupport);
        assert.equal(titleOfSupport, 'How can we help you today?');
        console.log(`The title of support page is "${titleOfSupport}"`);

        await this.closeCurrentWindow();

        await this.click(helpOfProject.helpButton, helpOfProject.reference);

        await this.switchToIframe(commonActions.idOfIframe);

        let referenceTitle = await this.getText(helpOfProject.titleOfReferencePage);

        assert.equal(referenceTitle, 'Reference');

        console.debug(`The side docs toggle text is: ${referenceTitle}`);

        await this.switchToDefaultFrame();

        await this.click(helpOfProject.openLinkButton);

        await this.switchToNewWindow();

        let newPageTitle = await this.getText(helpOfProject.titleOfReferencePage);

        assert.equal(newPageTitle, 'Reference');

        console.debug(`The title of new page is: ${newPageTitle}`);

        await this.closeCurrentWindow();

        await this.click(helpOfProject.helpButton, helpOfProject.blocks);

        await this.switchToIframe(helpOfProject.iframeOfSideDocs);

        let blocksTitle = await this.getText(helpOfProject.titleOfBlocksPage);

        assert.equal(blocksTitle, 'Blocks language');

        console.debug(`The side docs toggle text is: ${blocksTitle}`);

        await this.switchToDefaultFrame();

        await this.click(helpOfProject.collapseButton);

        await this.click(helpOfProject.helpButton, helpOfProject.javascript);

        await this.switchToIframe(helpOfProject.iframeOfSideDocs);

        let javascriptTitle = await this.getText(helpOfProject.titleOfJavaScriptPage);

        assert.equal(javascriptTitle, 'JavaScript');

        console.debug(`The side docs toggle text is: ${javascriptTitle}`);

        await this.switchToDefaultFrame();

        await this.click(helpOfProject.helpButton, helpOfProject.hardware);

        await this.switchToIframe(helpOfProject.iframeOfSideDocs);

        await this.click(helpOfProject.goBackButton);

        let goBackResult = await this.getText(helpOfProject.titleAfterGoBack);

        assert.notEqual(goBackResult, 'Device');

        await this.switchToDefaultFrame();

        await this.click(helpOfProject.helpButton, helpOfProject.buy);

        await this.switchToNewWindow();

        let headerOfBuyPage = await this.getText(helpOfProject.headerTitleOfBuy);

        assert.equal(headerOfBuyPage, 'Where to buy the BBC micro:bit and BBC micro:bit accessories');

        console.debug(`The header of buy page is: ${headerOfBuyPage}`);

        await this.closeCurrentWindow();

    }

    test() {
        it('Get Help List', async () => {
            return await this.helpList();
        });
    }
}

export let getHelpList = new GetHelpList();
