import { By } from 'selenium-webdriver';

export class DomObject {

    async actionForAll(actionName, findBys) {
        for (let criteria of findBys) {
            if (criteria) {
                console.debug(`Try to click the element by criteria: ${criteria}`);


                let findBy = await this.findBy(criteria);

                //wait until the element can be located
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

    async switchToWindow(value) {
        let handles = await driver.getAllWindowHandles();
        await driver.switchTo().window(handles[value]);
        if (value == 0) {
            driver.close();
        } else {
            return driver.switchTo().window(handles[value]);
        }
    }

    async switchToIframe(criteria) {
        let element = await driver.findElement(this.findBy(criteria));
        return await driver.switchTo().frame(element);
    }

    async getText(criteria) {
        let element = await driver.findElement(this.findBy(criteria));
        return await element.getText();
    }

    async getInputValue(criteria) {
        let element = await driver.findElement(this.findBy(criteria));
        return await element.getAttribute("value");
    }

    async sendKeys(criteria, keys) {

        let element = await driver.findElement(this.findBy(criteria));
        return await element.sendKeys(keys);

    }


    async click(...findBys) {
        let i = await this.actionForAll('click', findBys);
        return i;
    }
}