import { DomObject } from './lib/dom-object';
import assert from 'assert';


class NewProjectPage extends DomObject {

    async testCreateNewProject() {

        console.debug("Start testCreateNewProject()");

        //Create a new project
        await this.click('.newprojectcard', '.openproject');

        //Close the new project name input popup
        await this.click('.closeIcon');

        await this.takeScreenshot('editorPage1');

        //Assert the title is correct
        assert.equal(await this.getAttribute('.openproject', 'title'), 'Home');
        
        //Open the project name input popup again
        await this.click('.openproject');
        //Name the new project to "Project1"
        await this.sendKeys('input#projectNameInput', 'Project1');

        //Confirm the changes
        await this.click('.button.positive');
        
        //Validate the project is correctly created
        let text = await this.getText("[aria-label='My Projects'] .carouselitem:nth-child(2) .header");
        console.debug(`The header text in the first DIV of 'My Projects' is "${text}"`);

        assert.equal(text, "Project1");

        return true;
    }

    test() {
        it('Creae a new project and open it', async () => {
            return await this.testCreateNewProject();
        });
    }
}

export let newProjectPage = new NewProjectPage();
