import { DomObject } from '../lib/dom-object';
import assert from 'assert';
import { editorTools } from '../lib/css-value';

class EditorToolBar extends DomObject {

    async ToolBar() {

        console.debug('Start testMenuBar()');

        await driver.sleep(2000);

        await this.click(editorTools.toggleCategoryAdvanced, editorTools.collapseButton, editorTools.downloadButton);

        let downloadTitle = await this.getText(editorTools.headerTitle);

        assert.equal(downloadTitle, 'Download to your micro:bit');

        console.debug(`This is the title of download button:${downloadTitle}`);

        await this.click(editorTools.closeButton);

        let beforeName = await this.getAttribute(editorTools.nameOfInputBox, 'value');

        assert.equal(beforeName, 'Untitled');

        console.debug(`This is the name before changing:${beforeName}`);

        await this.sendKeys(editorTools.nameOfInputBox, 'Project');

        let afterChange = await this.getAttribute(editorTools.nameOfInputBox, 'value');

        assert.equal(afterChange, 'Project');

        console.debug(`This is the name before changing:${afterChange}`);
        
        await this.click(editorTools.saveInputName, editorTools.collapseButton);

    }

    test() {
        it('Look up the toolBar', async () => {
            return await this.ToolBar();
        });
    }
}
export let editorToolBar = new EditorToolBar();