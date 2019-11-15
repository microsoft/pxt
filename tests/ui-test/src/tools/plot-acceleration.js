import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { tools, commonActions } = require('../lib/css-value');

class PlotAcceleration extends DomObject {

    async plotAcceleration() {

        await this.click(tools.plotAcceleration, commonActions.closeButton,
            tools.plotAcceleration, commonActions.showInstructions);

        await this.switchToIframe(commonActions.idOfIframe);

        let headerTitle = await this.getText(tools.titleOfPlotAcceleration);
        assert.equal(headerTitle, 'Plot Acceleration');
        console.debug(`The header of the sidedocs is "${headerTitle}"`);
        
        await this.click(commonActions.openInNewTab);

        await this.closeCurrentWindow();
        
        await this.click(commonActions.microbitLogo);

    }

    test() {
        it('Start learning the "Plot Acceleration"', async () => {
            return await this.plotAcceleration();
        });
    }

}
export let plotAcceleration = new PlotAcceleration();