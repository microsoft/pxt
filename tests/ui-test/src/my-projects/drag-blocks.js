import { DomObject } from '../lib/dom-object';
import assert from "assert";
let { dragBlocks, commonActions } = require('../lib/css-value');

class BlocklyToolBox extends DomObject {

    async searchBox() {

        console.debug('Start testSearchBox()');

        await this.sendKeys(dragBlocks.searchBox, 'Basic');

        await driver.sleep(2000);

        let searchText = await this.getText(dragBlocks.searchLabel);

        assert.equal(searchText, "7 result matching 'basic'");

        console.debug(`This is the blockly search label: ${searchText}`);

    }
    async dragBlocks() {

        let target = await this.getRect(dragBlocks.foreverBlock);

        let start = await this.getRect(dragBlocks.sayHelloBlock);

        let xOffSet = Math.ceil(target.x - start.x);
        let yOffSet = Math.ceil(target.y - start.y + target.height / 2);
        await this.dragAndDropByCoordinate(dragBlocks.sayHelloBlock, xOffSet, yOffSet);

        await this.click(dragBlocks.basicItem);

        await this.dragAndDropByElement(dragBlocks.showStringBlock, dragBlocks.trashArea);

        for (let i = 1; i < 5; i++) {

            await this.contextClick(dragBlocks.insertBlock);

            if (i == 1) {

                await this.click(dragBlocks.duplicateOptionOfInsertBlock);

                let classValueOfDuplication = await this.getAttribute(dragBlocks.duplicateBlock, 'class');

                assert.equal(classValueOfDuplication, 'blocklyDraggable blocklySelected blocklyDisabled');

                console.log(`This is the class value of duplication:${classValueOfDuplication}`);

                await this.contextClick(dragBlocks.duplicateBlock);

                await this.click(dragBlocks.deleteDuplicateBlock);
            }
            if (i == 2) {

                await this.click(dragBlocks.addComment);

                await this.sendKeys(dragBlocks.textBox, 'fortest');

                await this.click(dragBlocks.commentDeleteButton);
            }
            if (i == 3) {

                await this.click(dragBlocks.helpOptionOfInsertBlock);

                await this.switchToIframe(commonActions.idOfIframe);

                let sideDocsTitle = await this.getText(dragBlocks.titleOfInsertBlock);

                await this.switchToDefaultFrame();

                assert.equal(sideDocsTitle, 'Show String');
                
                console.info(`The side docs title is ${sideDocsTitle}`);

                await this.click(dragBlocks.collapseButton);
            }
            if (i == 4) {
                await this.click(dragBlocks.deleteInsertBlock, dragBlocks.fullScreenButton);

                await this.catchScreenShot('LaunchInFullScreen');

                await this.click(dragBlocks.exitFullScreen, dragBlocks.microbitLogo);
        }
    }
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