import { DomObject } from './lib/dom-object';
import assert from 'assert';


class GetHelpList extends DomObject {

    async helpList() {

        await this.click('[title="Help"]', '[aria-label="Dropdown menu Help"] [title="Support"]');

        await this.switchToWindow();

        await this.click('[title="Help"]', '[aria-label="Dropdown menu Help"] [title="Reference"]');

        await this.switchToIframe('sidedocsframe');

        let sidedocstoggle = await this.getText('#reference');

        console.debug(`The side docs toggle text is: ${sidedocstoggle}`);

        assert.equal(sidedocstoggle, 'Reference');

        await this.click('[aria-label="Open documentation in new tab"]');

        await this.switchToWindow();


    }

    test() {
        it('Get Help List', async () => {
            return await this.helpList();
        });
    }
}

export let getHelpList = new GetHelpList();
