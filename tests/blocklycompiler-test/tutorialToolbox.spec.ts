/// <reference path="../../webapp/src/components/musicEditor/types.d.ts" />
/// <reference path="../../webapp/src/semantic-jquery.d.ts" />

import * as Blockly from "blockly";

describe("tutorial toolbox category visibility", () => {
    let shouldShowCategories: typeof import("../../webapp/src/tutorial").shouldShowTutorialCategories;

    before(async () => {
        await import("../../webapp/src/app");
        shouldShowCategories = (await import("../../webapp/src/tutorial")).shouldShowTutorialCategories;
    });

    it("shows categories for normal projects", () => {
        chai.assert.isTrue(shouldShowCategories());
    });

    it("shows categories for tutorials without a flyout-only request", () => {
        chai.assert.isTrue(shouldShowCategories({}));
    });

    it("hides the categorized toolbox before unified-toolbox filters are ready", () => {
        chai.assert.isFalse(shouldShowCategories({ unifiedToolbox: true }));
    });

    it("supports the legacy flyout-only flag", () => {
        chai.assert.isFalse(shouldShowCategories({ flyoutOnly: true }));
    });

    it("allows an explicit categorized fallback when filtering fails", () => {
        chai.assert.isTrue(shouldShowCategories({ unifiedToolbox: true }, true));
    });

    it("honors an explicit flyout-only editor state", () => {
        chai.assert.isFalse(shouldShowCategories({}, false));
    });
});

describe("tutorial Toolbox title zoom", () => {
    let WorkspaceHeader: typeof import("../../webapp/src/tutorial").WorkspaceHeader;
    let workspace: Blockly.WorkspaceSvg;

    before(async () => {
        await import("../../webapp/src/app");
        WorkspaceHeader = (await import("../../webapp/src/tutorial")).WorkspaceHeader;
    });

    beforeEach(() => {
        workspace = new Blockly.WorkspaceSvg(new Blockly.Options({ zoom: { startScale: 0.9 } }));
    });

    afterEach(() => {
        workspace.dispose();
    });

    function titleScale(scale: number) {
        workspace.scale = scale;
        const header = new WorkspaceHeader({});
        return header["headerStyle"](workspace)["--flyout-title-scale"];
    }

    it("keeps the original title size at the initial block zoom", () => {
        chai.assert.equal(titleScale(0.9), 1);
    });

    it("scales the title proportionally when zooming out", () => {
        chai.assert.closeTo(titleScale(0.45), 0.5, 0.001);
        chai.assert.closeTo(titleScale(0.2), 0.2 / 0.9, 0.001);
    });

    it("caps the title at its original size when zooming in", () => {
        chai.assert.equal(titleScale(1.8), 1);
    });

    it("uses the original size without a rendered block workspace", () => {
        const headlessWorkspace = new Blockly.Workspace();
        try {
            const header = new WorkspaceHeader({});
            chai.assert.equal(header["headerStyle"](headlessWorkspace)["--flyout-title-scale"], 1);
        } finally {
            headlessWorkspace.dispose();
        }
    });
});
