import { DomObject } from './lib/dom-object';
import assert from "assert";
import By from 'selenium-webdriver';
class BlocklyToolBox extends DomObject {

    async searchBox() {
        await this.sendKeys('.blocklySearchInputField', 'Basic');

        await driver.sleep(2000);

        let searchText = await this.getText('[id="blocklySearchLabel"]');

        console.debug(`This is the blockly search label: ${searchText}`);

        assert.equal(searchText, "7 result matching 'basic'");

    }
    async dragBlocks() {
        await this.dragAndDrop('g.blocklyDraggable:nth-child(4)', 'g.blocklyDraggable:nth-child(1)');

        await this.click('[role="treeitem"]:nth-child(2) .blocklyTreeRow');

        await this.dragAndDrop('g.blocklyDraggable:nth-child(8)', '.blocklyToolboxDiv');
        
        await this.click('#blocksEditorToolbox > div.blocklyTreeRoot > div > div:nth-child(2) > div.blocklyTreeRow');

        await this.contextClick('#blocksEditor > div > svg:nth-child(7) > g > g.blocklyBlockCanvas > g:nth-child(2) > path.blocklyPath.blocklyBlockBackground');

        await this.click('div.goog-menuitem');

        await this.switchToWindow();
        
        await this.click('.fullscreen-button');

        await this.catchScreenShot('LaunchInFullScreen');

    }
    

    test() {
        it('Get various blocks', async () => {
            return await this.searchBox();
        });

        it('Drag and drop blocks', async () => {
            return await this.dragBlocks();
        });

    }
}

export let blocklyToolBox = new BlocklyToolBox();