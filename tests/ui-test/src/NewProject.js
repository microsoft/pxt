import {DomObject} from './lib/domObject';
import {By} from 'selenium-webdriver';

class NewProjectPage extends DomObject {

    async getCodeSource() {

        console.debug("Start testGetCodeSource()");

        await this.click('.newprojectcard', '.openproject');
        await driver.sleep(1000);

        console.debug(`Input`);
        //   await driver.findElement(By.css('input#projectNameInput')).sendKeys('fortest');

        return await this.click(By.className('icon close remove circle '));
    }

    async testGetCodeSource() {
        return await this.getCodeSource();
    }

    test(){
        it('Get the code source', async () =>{
            return await this.testGetCodeSource();
        });
    }
}

export let newProjectPage = new NewProjectPage();
