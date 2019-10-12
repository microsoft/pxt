import { DomObject } from './lib/dom-object';
import assert from "assert";
class BlocklyToolBox extends DomObject {

    async searchBox() {
        const searchBox = '.blocklySearchInputField';
        await this.sendKeys(searchBox, 'Basic');

        await driver.sleep(2000);

        const searchLabel = '[id="blocklySearchLabel"]';

        let searchText = await this.getText(searchLabel);

        console.debug(`This is the blockly search label: ${searchText}`);

        assert.equal(searchText, "7 result matching 'basic'");

    }
    async dragBlocks() {

        const foreverBlock = 'g.blocklyDraggable:nth-child(2)';
        let target = await this.getRect(foreverBlock);
        console.info(`This is the target location:${target}`);
        console.log(target.x);
        console.log(target.y);

        const sayHelloBlock = 'g.blocklyDraggable:nth-child(4)';
        let start = await this.getRect(sayHelloBlock);

        let xOffSet = Math.ceil(target.x - start.x);
        let yOffSet = Math.ceil(target.y - start.y + target.height / 2);
        await this.dragAndDropByCoordinate(sayHelloBlock, xOffSet, yOffSet);

        const basicItem = '[role="treeitem"]:nth-child(2) .blocklyTreeRow';
        await this.click(basicItem);

        await this.dragAndDropByElement('g.blocklyDraggable:nth-child(8)[data-shapes="stack"]', 'div.blocklyToolboxDiv');

        let insertBlock = 'g.blocklyDraggable:nth-child(2)';
        await this.contextClick(insertBlock);

        const helpInContextMenu = 'div.goog-menuitem:nth-child(4)';
        await this.click(helpInContextMenu);

        const iframeIdOfHelp = '#sidedocsframe';
        await this.switchToIframe(iframeIdOfHelp);

        let sidedocsTitle = await this.getText('#show-string');
        await this.switchToDefaultFrame();

        assert.equal(sidedocsTitle, 'Show String');
        console.info(`The side docs title is ${sidedocsTitle}`);

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