import { DomObject } from './lib/dom-object';
import assert from "assert";

class BlocklyToolBox extends DomObject {

    async searchBox() {
        await this.sendKeys('.blocklySearchInputField', 'Basic');
        await driver.sleep(2000);
        let searchText = await this.getText('[id="blocklySearchLabel"]');
        console.debug(`This is the blockly search label: ${searchText}`);
        assert.equal(searchText, "7 result matching 'basic'");

    }
    async removeBlocks() {
        await this.dragAndDrop('g.blocklyDraggable:nth-child(4)', '.blocklyToolboxDiv');

    }
    async matchBlocks() {
        await this.click('[role="treeitem"]:nth-child(1) .blocklyTreeRow');
        await this.dragAndDrop('g.blocklyDraggable:nth-child(4)', 'g.blocklyDraggable:nth-child(1)');
        await this.click('.fullscreen-button');
        await this.catchScreenShot('LaunchInFullScreen');

    }

    test() {
        it('Get various blocks', async () => {
            return await this.searchBox();
        });
        it('Remove the block', async () => {
            return await this.removeBlocks();
        });
        it('Match blocks', async () => {
            return await this.matchBlocks();
        });
    }
}

export let blocklyToolBox = new BlocklyToolBox();