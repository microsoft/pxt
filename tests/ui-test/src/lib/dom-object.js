import { By } from 'selenium-webdriver';
import fs from 'fs';
import dateformat from 'dateformat';

const screenshotsFolder = './screenshots';

export class DomObject {

    async actionForAll(actionName, findBys) {
        for (let criteria of findBys) {
            if (criteria) {
                console.debug(`Try to click the element by criteria: ${criteria}`);

                let findBy = this.findBy(criteria);

                //wait until the element can be located
                let element = await this.waitforElementLocated(findBy);

                //Sleep for 2 seconds to make sure the element's state is stable for interactions
                await driver.sleep(2000);

                await element[actionName]();
            }
        }
        return true;
    }

    async waitforElementLocated(criteria) {
        let findBy = this.findBy(criteria);

        let element = await driver.wait(until.elementLocated(findBy));
        return element;
    }

    findBy(criteria) {
        if (typeof criteria === 'string') {
            return By.css(criteria);
        }
        return criteria;
    }

    async getText(criteria) {
        let element = await this.waitforElementLocated(this.findBy(criteria));
        return await element.getText();
    }

    async sendKeys(criteria, keys) {

        let element = await driver.findElement(this.findBy(criteria));
        await element.sendKeys(keys);
        return true;
    }


    async click(...findBys) {
        return await this.actionForAll('click', findBys);
    }

    async takeScreenshot(name) {
        if (!fs.existsSync(screenshotsFolder)) {
            fs.mkdirSync(screenshotsFolder);
        }

        let base64String = await driver.takeScreenshot();
        let fileName = name + "-" + dateformat(new Date(), "yyyymmddHHMMssl");

        fs.writeFile(`${screenshotsFolder}/${fileName}.png`, base64String, 'base64', function (err) {
            if (!err) {
                console.error(err);
            }
        });

        return true;
    }

    async getAttribute(criteria, attributeName) {
        let element = await this.waitforElementLocated(this.findBy(criteria));
        return element.getAttribute(attributeName);
    }
}