/// <reference path="../../webapp/src/components/musicEditor/types.d.ts" />
/// <reference path="../../webapp/src/semantic-jquery.d.ts" />

import * as Blockly from "blockly";

describe("block editor workspace resizing", () => {
    let Editor: typeof import("../../webapp/src/blocks").Editor;

    before(async () => {
        await import("../../webapp/src/app");
        Editor = (await import("../../webapp/src/blocks")).Editor;
    });

    function dragEvent(isStart: boolean): Blockly.Events.BlockDrag {
        const event = new Blockly.Events.BlockDrag();
        event.isStart = isStart;
        return event;
    }

    function createHarness(hasCategories: boolean, dragging: boolean) {
        const div = document.createElement("div");
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        div.appendChild(svg);
        let workspaceResizes = 0;
        let toolboxResizes = 0;
        let fieldEditorResizes = 0;
        const workspace = {
            options: { hasCategories },
            isDragging: () => dragging,
            getParentSvg: () => svg,
            getCachedParentSvgSize: () => ({ width: 0, height: 0 }),
            setCachedParentSvgSize: () => { },
            resize: () => { workspaceResizes++; },
        };
        const editor = {
            editor: workspace,
            pendingResize: false,
            getBlocksAreaDiv: () => div,
            getBlocksEditorDiv: () => div,
            resizeToolbox: () => { toolboxResizes++; },
            resizeFieldEditorView: () => { fieldEditorResizes++; },
            resize() {
                Editor.prototype.resize.call(this);
            },
        };

        return {
            editor,
            setDragging(value: boolean) {
                dragging = value;
            },
            handleEvent(event: Blockly.Events.Abstract) {
                Editor.prototype["onBlockDrag"].call(editor, event);
            },
            assertResizeCount(expected: number) {
                chai.assert.equal(workspaceResizes, expected);
                chai.assert.equal(toolboxResizes, expected);
                chai.assert.equal(fieldEditorResizes, expected);
            },
        };
    }

    it("defers pinned-flyout resizing while a block is dragged", () => {
        const harness = createHarness(false, true);
        harness.editor.resize();
        harness.editor.resize();

        harness.assertResizeCount(0);
        chai.assert.isTrue(harness.editor.pendingResize);
    });

    it("applies a deferred resize once when the drag ends", () => {
        const harness = createHarness(false, true);
        harness.editor.resize();
        harness.setDragging(false);
        harness.handleEvent(dragEvent(false));
        harness.handleEvent(dragEvent(false));

        harness.assertResizeCount(1);
        chai.assert.isFalse(harness.editor.pendingResize);
    });

    it("does not flush for drag-start or unrelated events", () => {
        const harness = createHarness(false, true);
        harness.editor.resize();
        harness.handleEvent(dragEvent(true));
        harness.handleEvent(new Blockly.Events.BlockCreate());

        harness.assertResizeCount(0);
        chai.assert.isTrue(harness.editor.pendingResize);
    });

    it("preserves categorized-toolbox resizing during dragging", () => {
        const harness = createHarness(true, true);
        harness.editor.resize();

        harness.assertResizeCount(1);
        chai.assert.isFalse(harness.editor.pendingResize);
    });

    it("resizes pinned flyouts normally when no drag is active", () => {
        const harness = createHarness(false, false);
        harness.editor.resize();
        harness.handleEvent(dragEvent(false));

        harness.assertResizeCount(1);
        chai.assert.isFalse(harness.editor.pendingResize);
    });
});
