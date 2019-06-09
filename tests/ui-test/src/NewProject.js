const { By } = require('selenium-webdriver');


class DomObject {

    async actionForAll(actionName, ...findBys){
        for (let findBy of findBys) {
            if (findBy) {
                console.debug(`Try to click the element by criteria: ${findBy}`);

                if (typeof findBy === 'string') {
                    findBy = await By.css(findBy);
                }
        
                let element = await driver.findElement(findBy);
                await element[actionName]();
                await driver.sleep(8000);            
            }
        }
        return true;
    }
    async sendKeys(...findBys){
        for (let findBy of findBys) {
            if (findBy) {
                console.debug(`Try to click the element by criteria: ${findBy}`);

                if (typeof findBy === 'string') {
                    findBy = By.css(findBy);
                }
        
                let element = await driver.findElement(findBy).click();
                await driver.sleep(8000);            
            }
        }
        return true;
    }


    async click(...findBys) {
        let x = await this.actionForAll("click", findBys);
        return x;
    }
}
class NewProjectPage extends DomObject {

    testGetCodeSource() {
        it('Get the code source', async () => {
            await this.click('.newprojectcard',
                By.className('ui item link  icon openproject '),
                By.className('icon close remove circle ')
            );
        });
    }

    test() {
        this.testGetCodeSource();
    }
}

export let newProjectPage = new NewProjectPage();
