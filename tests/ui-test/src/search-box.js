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
    async dragBlocks() {

        let target = await this.getRect('g.blocklyDraggable:nth-child(1)');
        console.info(`This is the target location:${target}`);
        console.log(target.x);
        console.log(target.y);

        await this.dragAndDropByCoordinate('g.blocklyDraggable:nth-child(4)',-30,-150);

        await this.click('[role="treeitem"]:nth-child(2) .blocklyTreeRow');
//有点问题
        // await this.dragAndDropByElement('g.blocklyDraggable:nth-child(6)', 'div.blocklyTreeRoot');

        await this.contextClick('g.blocklyDraggable:nth-child(2) g.blocklyDraggable');

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