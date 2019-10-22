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

        const sayHelloBlock = 'g.blocklyDraggable:nth-child(4)';
        let start = await this.getRect(sayHelloBlock);

        let xOffSet = Math.ceil(target.x - start.x);
        let yOffSet = Math.ceil(target.y - start.y + target.height / 2);
        await this.dragAndDropByCoordinate(sayHelloBlock, xOffSet, yOffSet);

        const basicItem = '[aria-label="Toggle category Basic"]';
        await this.click(basicItem);

        const showStringBlock = 'g.blocklyDraggable:nth-child(8)[data-shapes="stack"]';
        await this.dragAndDropByElement(showStringBlock, 'div.blocklyToolboxDiv');
        
        const insertBlock = 'g.blocklyDraggable:nth-child(2)';
        await this.contextClick(insertBlock);
        
        const duplicateOptionOfInsertBlock = '.goog-menuitem:nth-child(1)';
        await this.click(duplicateOptionOfInsertBlock);
        let classValueOfDuplication = await this.getAttribute('.blocklySelected.blocklyDisabled','class');
        assert.equal(classValueOfDuplication,'blocklyDraggable blocklySelected blocklyDisabled');
        console.log(`This is the class value of duplication:${classValueOfDuplication}`);

        const duplication= '.blocklySelected.blocklyDisabled';
        await this.contextClick(duplication);
        const deleteDuplicateBlock = '.goog-menuitem:nth-child(3)';
        await this.click(deleteDuplicateBlock);

        await this.contextClick(insertBlock);
        const addComment = '.goog-menuitem:nth-child(2)';
        await this.click(addComment);

        const textBox = 'body textarea';
        await this.sendKeys(textBox,'fortest');

        const commentDeleteButton = 'g.blocklyCommentDeleteIcon';
        await this.click(commentDeleteButton);
        
        await this.contextClick(insertBlock);

        const helpOptionOfInsertBlock = '.goog-menuitem:nth-child(4)';
        await this.click(helpOptionOfInsertBlock);

        const iframeIdOfHelp = '#sidedocsframe';
        await this.switchToIframe(iframeIdOfHelp);

        let sideDocsTitle = await this.getText('#show-string');
        await this.switchToDefaultFrame();

        assert.equal(sideDocsTitle, 'Show String');
        console.info(`The side docs title is ${sideDocsTitle}`);
        const collapseButton = '[id="sidedocstoggle"]';
        await this.click(collapseButton);

        await this.contextClick(insertBlock);
        const deleteInsertBlock = '.goog-menuitem:nth-child(3)';
        await this.click(deleteInsertBlock);
        
        await this.click('.fullscreen-button');

        await this.catchScreenShot('LaunchInFullScreen');

        await this.click('[title="Exit fullscreen mode"]');

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