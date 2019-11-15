import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { fashion, commonActions } = require('../lib/css-value');

class DuctTapeWallet extends DomObject {

    async ductTapeWallet() {

        await this.click(fashion.ductTapeWallet, commonActions.closeButton,
            fashion.ductTapeWallet, commonActions.showInstructions);

        await this.switchToNewWindow();

        let headerTitle = await this.getText(fashion.titleOfWallet);
        assert.equal(headerTitle, 'Wallet');
        console.debug(`The header of the new page is "${headerTitle}"`);
        
        await this.click(commonActions.getStartButton);

        let newPageTitle = await this.getText(fashion.titleOfNewPage);
        assert.equal(newPageTitle, 'Make');
        console.debug(`The title of the new page is "${newPageTitle}"`);

        await this.closeCurrentWindow();
        
        await this.click(commonActions.closeButton);

    }

    test() {
        it('Start learning the "Duct Tape Wallet"', async () => {
            return await this.ductTapeWallet();
        });
    }

}
export let ductTapeWallet = new DuctTapeWallet();