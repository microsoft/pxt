import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { newProject } = require('../lib/css-value');

class NewProjectPage extends DomObject {

    async getCodeSource() {

        console.debug("Start testGetCodeSource()");

        await this.click(newProject.newProjectButton, newProject.homeOfProject, newProject.closeButtonOfHomePage);

        await this.click(newProject.homeOfProject);

        await this.sendKeys(newProject.inputProjectName, 'Project1');

        await this.click(newProject.saveButtonOfHomePage);

        let text = await this.getText(newProject.projectTitle);
        
        assert.equal(text, "Project1");
       
        console.debug(`The header text in the first DIV of 'My Projects' is: ${text}"`);

        await this.click(newProject.openProject);
    }

    test() {
        it('Get the code source', async () => {
            return await this.getCodeSource();
        });
    }
}

export let newProjectPage = new NewProjectPage();
