import { DomObject } from './lib/dom-object';
import assert from 'assert';

class ViewMenuBar extends DomObject {

    async menuBar() {
        await driver.sleep(2000);

        await this.click('[role="treeitem"]:nth-child(11) .blocklyTreeRow', '.collapse-button:nth-child(1)', '#downloadArea .download-button');

        let downloadTitle = await this.getText('.header-title');

        console.debug(`This is the title of download button:${downloadTitle}`);

        assert.equal(downloadTitle, 'Download to your micro:bit');

        await this.click('.closeIcon');

        let beforeName = await this.getAttribute('input#fileNameInput2', 'value');

        console.debug(`This is the name before changing:${beforeName}`);

        assert.equal(beforeName, 'Untitled');

        await this.sendKeys('input#fileNameInput2', 'Project');

        let afterChange = await this.getAttribute('input#fileNameInput2', 'value');

        console.debug(`This is the name before changing:${afterChange}`);

        assert.equal(afterChange, 'UntitledProject');

        await this.click('#projectNameArea [title="Save"]');
    }

    test() {
        it('Look up the menubar', async () => {
            return await this.menuBar();
        });
    }
}
export let viewMenuBar = new ViewMenuBar();