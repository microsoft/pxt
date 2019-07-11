import { DomObject } from './lib/dom-object';
import assert from 'assert';


class NewProjectPage extends DomObject {

    async testCreateNewProject() {

        console.debug("Start testGetCodeSource()");

        await this.click('.newprojectcard', '.openproject', '.closeIcon');
        await this.takeScreenshot('editorPage1');
        assert.equal(await this.getAttribute('.openproject'), 'Home');

        await this.click('.openproject');
        await this.sendKeys('input#projectNameInput', 'Project1');

        await this.click('.button.positive');
        
        let text = await this.getText("[aria-label='My Projects'] .carouselitem:nth-child(2) .header");
        console.debug(`The header text in the first DIV of 'My Projects' is "${text}"`);

        assert.equal(text, "Project1");

        await this.click('.content .header');

        return true;
    }

    test() {
        it('Creae a new project and open it', async () => {
            return await this.testCreateNewProject();
        });
    }
}

export let newProjectPage = new NewProjectPage();
