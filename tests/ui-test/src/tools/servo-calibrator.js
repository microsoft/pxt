import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { tools, commonActions } = require('../lib/css-value');

class ServoCalibrator extends DomObject {

    async servoCalibrator() {

        await this.click(tools.servoCalibrator, commonActions.closeButton,
            tools.servoCalibrator, commonActions.showInstructions);

        await this.switchToIframe(commonActions.idOfIframe);

        let headerTitle = await this.getText(tools.titleOfServoCalibrator);
        assert.equal(headerTitle, 'Servo Calibrator');
        console.debug(`The header of the sidedocs is "${headerTitle}"`);
        
        await this.click(commonActions.openInNewTab);

        await this.closeCurrentWindow();
        
        await this.click(commonActions.microbitLogo);

    }

    test() {
        it('Start learning the "Servo Calibrator"', async () => {
            return await this.servoCalibrator();
        });
    }

}
export let servoCalibrator = new ServoCalibrator();