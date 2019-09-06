import { DomObject } from './lib/dom-object';
import assert from 'assert';


class GetHelpList extends DomObject {

    async helpList() {

        await this.click('[title="Help"]', '[aria-label="Dropdown menu Help"] [title="Support"]');

        await this.switchToWindow();

        await this.click('[title="Help"]', '[aria-label="Dropdown menu Help"] [title="Reference"]');

        await this.switchToIframe('#sidedocsframe');

        let referenceTitle = await this.getText('#reference');

        console.debug(`The side docs toggle text is: ${referenceTitle}`);

        assert.equal(referenceTitle, 'Reference');

        await this.switchToDefaultFrame();

        await this.click('#sidedocsbar');

        await driver.sleep(2000);//Currently, this static waiting cannot ignore, will find the reason soon.

        await this.switchToWindow();

        await this.click('[title="Help"]', '[aria-label="Dropdown menu Help"] [title="Blocks"]');

        await this.switchToIframe('#sidedocsframe');

        let blocksTitle = await this.getText('#blocks-language');

        console.debug(`The side docs toggle text is: ${blocksTitle}`);

        assert.equal(blocksTitle, 'Blocks language');

        await this.switchToDefaultFrame();

        await this.click('#sidedocstoggle');

        await this.click('[title="Help"]', '[aria-label="Dropdown menu Help"] [title="JavaScript"]');

        await this.switchToIframe('#sidedocsframe');

        let javascriptTitle = await this.getText('#javascript');

        console.debug(`The side docs toggle text is: ${javascriptTitle}`);

        assert.equal(javascriptTitle, 'JavaScript');

        await this.switchToDefaultFrame();

        await this.click('[title="Help"]', '[aria-label="Dropdown menu Help"] [title="Hardware"]');

        await this.switchToIframe('#sidedocsframe');

        await this.click('#sidedocs-back-button');

        let goBackResult = await this.getText('.ui.text h1');

        assert.notEqual(goBackResult, 'Device');

        await this.switchToDefaultFrame();

        await this.click('[title="Help"]', '[aria-label="Dropdown menu Help"] [title="Buy"]');

        await this.switchToWindow();
    }

    test() {
        it('Get Help List', async () => {
            return await this.helpList();
        });
    }
}

export let getHelpList = new GetHelpList();
