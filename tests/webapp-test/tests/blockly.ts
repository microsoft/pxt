
import * as webdriverio from "webdriverio";
import * as chai from "chai";
import * as U from "../testutils";

declare let Blockly: any;

describe('Blocks editor', function () {
    it('delete some blocks by drag and drop', function () {
        U.loadBlocks({}, '_PCWEutUcRUPT');

        // Get current number of blocks in workspace
        const beforeNumberOfBlocks = U.numberOfBlocks();

        // Get position of the first
        const topBlockCoordinates = browser.execute(function() {
            return Blockly.mainWorkspace.getTopBlocks()[0].getSvgRoot().getClientRects()[0];
        });
        const startX = (topBlockCoordinates as any).left + 5;
        const startY = (topBlockCoordinates as any).top + 5;

        const toolboxDivCoordinates = browser.execute(function() {
            return document.querySelectorAll('.blocklyToolboxDiv')[0].getClientRects()[0];
        });
        const endX = (toolboxDivCoordinates as any).left + ((toolboxDivCoordinates as any).width / 2);
        const endY = (toolboxDivCoordinates as any).height / 2;

        browser.moveToObject('.blocklySvg > .blocklyWorkspace > .blocklyBlockCanvas', 5, 5);
        browser.buttonDown(0);
        browser.moveTo(null, -50, 0);
        browser.buttonUp(0);

        // (browser as any).actions([{
        //     "type": "pointer",
        //     "id": "finger1",
        //     "parameters": {"pointerType": "touch"},
        //     "actions": [
        //         {"type": "pointerMove", "duration": 0, "x": startX, "y": startY},
        //         {"type": "pointerDown", "button": 0},
        //         {"type": "pause", "duration": 500},
        //         {"type": "pointerMove", "duration": 1000, "origin": "pointer", "x": endX, "y": endY},
        //         {"type": "pointerUp", "button": 0}
        //     ]
        // }]);
        // (browser as any).actions();

        // Click on the group of blocks
        // browser.dragAndDrop('.blocklySvg > .blocklyWorkspace > .blocklyBlockCanvas',
        //     '#blocklyTrashIcon'
        // );

        browser.pause(500);

        const afterNumberOfBlocks = U.numberOfBlocks();
        chai.assert(afterNumberOfBlocks < beforeNumberOfBlocks, "Failed to delete some blocks using drag");
    });

    it('delete all blocks by context menu', function () {
        U.loadBlocks({}, '_PCWEutUcRUPT');

        // Get current number of blocks in workspace
        const beforeNumberOfBlocks = U.numberOfBlocks();

        U.rightClick('.blocklyScrollbarVertical', -10, 1);

        browser.waitForExist('.blocklyWidgetDiv .blocklyContextMenu');

        browser
            .execute("return document.querySelectorAll('.blocklyWidgetDiv .blocklyContextMenu > .goog-menuitem')[1]")
            .click();

        browser.pause(100);

        browser
            .execute("return document.querySelectorAll('.ui.modal.coredialog .ui.button.approve.positive')[0]")
            .click();

        browser.pause(500);

        const afterNumberOfBlocks = U.numberOfBlocks();
        chai.assert(afterNumberOfBlocks == 0 && beforeNumberOfBlocks != 0, "Failed to delete all blocks using context menu");
    });
});
