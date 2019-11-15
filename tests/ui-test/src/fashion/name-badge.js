import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { fashion, commonActions } = require('../lib/css-value');

class NameBadge extends DomObject {

    async nameBadge() {

        await this.click(fashion.nameBadge, commonActions.closeButton,
            fashion.nameBadge, commonActions.showInstructions);

        await this.switchToNewWindow();

        let headerTitle = await this.getText(fashion.titleOfNameBadge);
        assert.equal(headerTitle, 'Name Badge');
        console.debug(`The header of the new page is "${headerTitle}"`);
        
        await this.closeCurrentWindow();
        
        await this.click(commonActions.closeButton);

    }

    test() {
        it('Start learning the "Name Badge"', async () => {
            return await this.nameBadge();
        });
    }

}
export let nameBadge = new NameBadge();