/// <reference path="../../built/pxtlib.d.ts" />

import * as compiler from "./compiler";
import * as tutorialfile from "./tutorial";

/**
* Check the user's code to the tutorial and returns a Tutorial status of the user's code
* @param step the current tutorial step
* @param workspaceBlocks Blockly blocks used of workspace
* @param blockinfo Typescripts of the workspace
* @return A TutorialCodeStatus
*/
export async function validate(tutorial: pxt.tutorial.TutorialOptions, step: pxt.tutorial.TutorialStepInfo, workspaceBlocks: Blockly.Block[], blockinfo: pxtc.BlocksInfo): Promise<pxt.editor.TutorialCodeStatus> {
    // Check to make sure blocks are in the workspace
    if (workspaceBlocks.length > 0) {
        // User blocks
        const userBlockTypes = workspaceBlocks.map(b => b.type);
        const usersBlockUsed = blockCount(userBlockTypes);
        // Tutorial blocks
        const indexdb = await tutorialBlockList(tutorial, step);
        const tutorialBlockUsed = extractBlockSnippet(tutorial, indexdb);
        // Checks for user's blocks against tutorial blocks
        if (!validateNumberOfBlocks(usersBlockUsed, tutorialBlockUsed)) {
            return pxt.editor.TutorialCodeStatus.Invalid;
        }
        return pxt.editor.TutorialCodeStatus.Valid;
    }
    return pxt.editor.TutorialCodeStatus.Unknown;
}

/**
* Loops through an array of blocks and returns a map of blocks and the count for that block
* @param arr a string array of blocks
* @return a map <Block type, frequency>
*/
function blockCount(arr: string[]): pxt.Map<number> {
    let frequencyMap: pxt.Map<number> = {};
    for (let i: number = 0; i < arr.length; i++) {
        if (!frequencyMap[arr[i]]) {
            frequencyMap[arr[i]] = 0;
        }
        frequencyMap[arr[i]] = frequencyMap[arr[i]] + 1;
    }
    return frequencyMap;
}

/**
* Returns information from index database
* @param tutorial Typescripts of the workspace
* @param step the current tutorial step
* @return indexdb's tutorial code snippets
*/
function tutorialBlockList(tutorial: pxt.tutorial.TutorialOptions, step: pxt.tutorial.TutorialStepInfo, skipCache = false) {
    return pxt.BrowserUtils.tutorialInfoDbAsync()
        .then(db => db.getAsync(tutorial.tutorial, tutorial.tutorialCode)
            .then(entry => {
                if ((entry === null || entry === void 0 ? void 0 : entry.blocks) && Object.keys(entry.blocks).length > 0 && !skipCache) {
                    pxt.tickEvent(`tutorial.usedblocks.indexeddb`, { tutorial: tutorial.tutorial });
                    // populate snippets if usedBlocks are present, but snippets are not
                    if (!(entry === null || entry === void 0 ? void 0 : entry.snippets))
                        tutorialfile.getUsedBlocksInternalAsync(tutorial.tutorialCode, tutorial.tutorial, tutorial.language, db, skipCache);
                    return Promise.resolve({ snippetBlocks: entry.snippets, usedBlocks: entry.blocks });
                }
                else {
                    return tutorialfile.getUsedBlocksInternalAsync(tutorial.tutorialCode, tutorial.tutorial, tutorial.language, db, skipCache);
                }
            })
            .catch((err) => {
                // fall back to full blocks decompile on error
                return tutorialfile.getUsedBlocksInternalAsync(tutorial.tutorialCode, tutorial.tutorial, tutorial.language, db, skipCache);
            })).catch((err) => {
                // fall back to full blocks decompile on error
                return tutorialfile.getUsedBlocksInternalAsync(tutorial.tutorialCode, tutorial.tutorial, tutorial.language, null, skipCache);
            });
}
/**
* Extract the tutorial blocks used from code snippet
* @param tutorial tutorial info
* @param indexdb database from index
* @return the tutorial blocks used for the current step
*/
function extractBlockSnippet(tutorial: pxt.tutorial.TutorialOptions, indexdb: tutorialfile.ITutorialBlocks) {
    const { tutorialStepInfo, tutorialStep } = tutorial;
    const { snippetBlocks, usedBlocks } = indexdb;
    const snippetKeys = Object.keys(snippetBlocks);
    const snippetStepKey = snippetKeys[tutorialStep];
    const blockMap = snippetBlocks[snippetStepKey];
    return blockMap;
}

/**
* Checks if the all required number of blocks for a tutorial step is used, returns a boolean
* @param usersBlockUsed an array of strings
* @param tutorialBlockUsed the next available index
* @return true if all the required tutorial blocks were used, false otherwise
*/
function validateNumberOfBlocks(usersBlockUsed: pxt.Map<number>, tutorialBlockUsed: pxt.Map<number>): boolean {
    const userBlockKeys = Object.keys(usersBlockUsed);
    const tutorialBlockKeys = Object.keys(tutorialBlockUsed);
    if (userBlockKeys.length < tutorialBlockKeys.length) { // user doesn't have enough blocks
        return false;
    }
    for (let i: number = 0; i < tutorialBlockKeys.length; i++) {
        let tutorialBlockKey = tutorialBlockKeys[i];
        if (!usersBlockUsed[tutorialBlockKey]) { // user did not use a specific block
            return false;
        }
        if (usersBlockUsed[tutorialBlockKey] < tutorialBlockUsed[tutorialBlockKey]) { // user did not use enough of a certain block
            return false;
        }
    }
    return true;
}