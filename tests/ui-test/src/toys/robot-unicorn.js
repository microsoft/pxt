import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { toys, commonActions } = require('../lib/css-value');

class RobotUnicorn extends DomObject {

    async robotUnicorn() {

        await this.click(toys.robotUnicorn, commonActions.closeButton,
            toys.robotUnicorn, commonActions.showInstructions);

        await this.switchToNewWindow();

        let headerTitle = await this.getText(toys.titleOfRobotUnicorn);
        assert.equal(headerTitle, 'Robot Unicorn');
        console.debug(`The header of the new page is "${headerTitle}"`);
        
        // await this.click(commonActions.getStartButton);

        await this.closeCurrentWindow();
        
        await this.click(commonActions.closeButton);

    }

    test() {
        it('Start learning the "Robot Unicorn"', async () => {
            return await this.robotUnicorn();
        });
    }

}
export let robotUnicorn = new RobotUnicorn();