/// <reference path="../../webapp/src/components/musicEditor/types.d.ts" />
/// <reference path="../../webapp/src/semantic-jquery.d.ts" />

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
