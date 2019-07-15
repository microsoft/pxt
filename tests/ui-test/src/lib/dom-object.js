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

    async switchToWindow() {
        let handles = await driver.getAllWindowHandles();
        await driver.switchTo().window(handles[1]);
        await driver.close();
        await driver.switchTo().window(handles[0]);

        return true;
    }


    async switchToIframe(iframe) {
        let frame = await driver.switchTo().frame(iframe);
        await driver.sleep(5000);
        return frame;
    }

    async switchToDefaultFrame() {
        return driver.switchTo().defaultContent();
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