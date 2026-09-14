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

        await this.testZoomControls();
        
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

    async testZoomControls() {
        const zoomIn = '#editorToolbarArea .zoomin-editortools-btn';
        const zoomOut = '#editorToolbarArea .zoomout-editortools-btn';
        const initialTitle = await this.getAttribute(zoomIn, 'title');
        const initialMatch = /^Zoom In \((\d+)%\)$/.exec(initialTitle);
        assert.ok(initialMatch, 'Zoom tooltip should show the current percentage');
        assert.equal(await this.getAttribute(zoomOut, 'title'), `Zoom Out (${initialMatch[1]}%)`);

        await this.click(zoomIn);
        const zoomedTitle = await this.getAttribute(zoomIn, 'title');
        const zoomedMatch = /^Zoom In \((\d+)%\)$/.exec(zoomedTitle);
        assert.ok(zoomedMatch, 'Zoom tooltip should retain the percentage after zooming');
        assert.ok(Number(zoomedMatch[1]) > Number(initialMatch[1]));
        assert.equal(await this.getAttribute(zoomOut, 'title'), `Zoom Out (${zoomedMatch[1]}%)`);

        await this.click(zoomOut);
        assert.equal(await this.getAttribute(zoomIn, 'title'), initialTitle);
        assert.equal(await this.getAttribute(zoomOut, 'title'), `Zoom Out (${initialMatch[1]}%)`);
    }

    test() {
        it('Creae a new project and open it', async () => {
            return await this.testCreateNewProject();
        });
    }
}

export let newProjectPage = new NewProjectPage();
