import { By } from 'selenium-webdriver';
import util from 'util';
import fs from 'fs';
const writeFile = util.promisify(fs.writeFile);

export class DomObject {

    async actionForAll(actionName, findBys) {
        for (let criteria of findBys) {
            if (criteria) {
                console.debug(`Try to click the element by criteria: ${criteria}`);

                let findBy = await this.findBy(criteria);

                //wait until the element can be located
                await driver.wait(until.elementLocated(findBy));

                let element = await driver.wait(until.elementLocated(findBy));

                //Sleep for 2 seconds to make sure the element's state is stable for interactions
                await driver.sleep(2000);

                await element[actionName]();
            }
        }
        return true;
    }

    findBy(criteria) {
        if (typeof criteria === 'string') {
            return By.css(criteria);
        }
        return criteria;
    }

    async getText(criteria) {
        let element = await driver.findElement(this.findBy(criteria));
        return await element.getText();
    }

    async sendKeys(criteria, keys) {

        let element = await driver.findElement(this.findBy(criteria));
        await element.sendKeys(keys);
        await driver.sleep(1000);
        return true;
    }


    async click(...findBys) {
        let i = await this.actionForAll('click', findBys);
        return i;
    }

    async takeScreenshot(name) {
        let element = await driver.takeScreenshot().then(
            function (image, err) {
                writeFile(`./screenshot/${name}.png`, image, 'base64', function (err) {
                    console.log(err);
                });
            }
        );
        return true;
    }

    async getAttribute(criteria) {
        let element = await driver.findElement(this.findBy(criteria));
        return element.getAttribute('title');
    }
}