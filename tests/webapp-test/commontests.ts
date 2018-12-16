// Tutorial tests
import * as U from "./testutils";

import * as webdriverio from "webdriverio";
import * as chai from "chai";

export function tutorialTest(tutorialTest: pxt.tests.TutorialTest) {
    const tutorialPath = tutorialTest.path;
    U.loadTutorial(tutorialTest, tutorialPath);

    browser.pause(1000);

    // Check that a tutorial message exists, otherwise there was a problem loading the tutorial.
    chai.assert(browser.isExisting('.tutorialmessage'), "Tutorial failed to load, this most likely means the path was configured incorrectly");

    while (browser.isExisting('.ui.button.nextbutton')) {
        // Go through the tutorial at every step and verify a number of things.
        if (browser.isExisting('.ui.modal.hintdialog')) {
            // If the hint dialog is visible at this point, it means it's a full screen step.

            const hasCodeBlock = browser.isExisting('.hintdialog pre > code');
            const hasTextCodeBlock = hasCodeBlock && browser.isExisting('.hintdialog pre > code:not([class]');
            const hasBlockCodeBlock = hasCodeBlock && browser.isExisting('.hintdialog pre > code.lang-blocks');

            // If we have code blocks that are not lang-blocks, this is probably a typo somewhere. report it
            chai.assert(!hasTextCodeBlock,
                "The tutorial hint in '" + tutorialPath + "' shows a code block that is not blocks.");

            // If we have code blocks, let's make sure they decompiled
            if (hasBlockCodeBlock) {
                browser.waitUntil(() => {
                    return !browser.isExisting('.ui.segment.loading');
                });
            }
            // Dismiss the step and continue.
            browser
                .click('.ui.modal.hintdialog .ui.button.approve.green');

            browser.pause(500);
        } else {
            // Click the hint.
            browser
                .click('.tutorialmessage');

            browser.pause(500);

            if (browser.isExisting('.ui.modal.hintdialog')) {
                const hasCodeBlock = browser.isExisting('.hintdialog pre > code');
                const hasTextCodeBlock = hasCodeBlock && browser.isExisting('.hintdialog pre > code:not([class]');
                const hasBlockCodeBlock = hasCodeBlock && browser.isExisting('.hintdialog pre > code.lang-blocks');

                // If we have code blocks that are not lang-blocks, this is probably a typo somewhere. report it
                chai.assert(!hasTextCodeBlock,
                    "The tutorial hint in '" + tutorialPath + "' shows a code block that is not blocks.");

                // If we have code blocks, let's make sure they decompiled
                if (hasBlockCodeBlock) {
                    browser.waitUntil(() => {
                        return !browser.isExisting('.ui.segment.loading');
                    });
                }

                // Click Ok if there's a modal.
                browser
                    .click('.ui.modal.hintdialog .ui.button.approve.green');

                browser.pause(500);
            } else if (browser.isExisting('.ui.modal')) {
                // Lightbox is on, click ok first
                browser
                    .click('.tutorialsegment .ui.button.okbutton');

                browser.pause(500);
            }

            // Click next.
            browser
                .click('.ui.button.nextbutton');

            browser.pause(500);
        }
    }

    chai.assert(browser.isExisting('.ui.button.orange'), "No Finish button");
}

export function importTest(importTest: pxt.tests.ImportTest) {
    U.loadHome(importTest);

    const url = importTest.url;
    const expectError = importTest.shouldFail || false;

    browser
        .click('.ui.button.import-dialog-btn');

    browser.waitForExist('.ui.modal.importdialog');

    // We assume there are two cards in the import dialog, if this changes we'll have to update this.
    // We also assume the import url button is the second one
    browser
        .execute("return document.querySelectorAll('.importdialog .ui.two.cards > div')[1]")
        .click();


    // Set the value in the input
    browser.setValue('.coredialog input', url);

    // Click on the OK button
    browser.click('.coredialog .ui.button.approve.positive');

    const errorToast = browser.isExisting('div > div > #errmsg');
    chai.assert(expectError == errorToast, "Error toast appeared when it wasn't supposed to or vice versa");

    if (!errorToast) {
        // We expect the project to load at this point. Verify that we're seeing a loading 
        chai.assert(browser.isExisting('.ui.main.loader'), "We were expecting a loader that says 'loading project'");

        // Wait for loader to finish
        browser
            .waitUntil(() => {
                return !browser.isExisting('.ui.main.loader');
            });

        // Verify that we're in the editor
        U.verifyInEditor();

        // Check that we're in the right editor
    }
}

export function blockSearchTest(blocklyTest: pxt.tests.BlocklyTest) {
    const searchTerm = blocklyTest.data.term;
    chai.assert(searchTerm, "Empty search term not supported");

    U.loadBlocks(blocklyTest);

    browser.setValue('input.blocklySearchInputField', searchTerm);

    browser.waitForVisible('.blocklyFlyout');

    const flyoutItems = browser.getHTML('.blocklyFlyout .blocklyBlockCanvas > g');
    chai.assert(flyoutItems.length > 0 || blocklyTest.shouldFail, "No elements in Flyout");
    chai.assert(!browser.isExisting('.blocklyFlyout .blocklyBlockCanvas > g.blocklyFlyoutLabel') || blocklyTest.shouldFail, "There were no search results for term: " + searchTerm);

}