/// <reference path="../../built/pxtlib.d.ts" />

import * as compiler from "./compiler";

/**
* Check the user's code to the tutorial and returns a Tutorial status of the user's code
* @param step the current tutorial step
* @param workspaceBlocks Blockly blocks used of workspace
* @param blockinfo Typescripts of the workspace
* @return A TutorialCodeStatus
*/
export async function validate(step: pxt.tutorial.TutorialStepInfo, workspaceBlocks: Blockly.Block[], blockinfo: pxtc.BlocksInfo): Promise<pxt.editor.TutorialCodeStatus> {
    // Check to make sure blocks are in the workspace
    if (workspaceBlocks.length > 0) {
        const userBlockTypes: string[] = workspaceBlocks.map(b => b.type);
        const tutorialBlockTypes: string[] = await tutorialBlockList(step, blockinfo);
        const usersBlockUsed: pxt.Map<number> = blockCount(userBlockTypes);
        const tutorialBlockUsed: pxt.Map<number> = blockCount(tutorialBlockTypes);
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
* Checks to see if the array has the target value and returns the target value's index
* @param step the current tutorial step
* @param blockinfo Typescripts of the workspace
* @return the tutorial blocks
*/
function tutorialBlockList(step: pxt.tutorial.TutorialStepInfo, blocksInfo: pxtc.BlocksInfo): Promise<string[]> {
    let hintContent = step.hintContentMd;
    if (hintContent.includes("\`\`\`blocks")) {
        hintContent = hintContent.replace("\`\`\`blocks", "");
        hintContent = hintContent.replace("\`\`\`", "");
    }
    let tutorialBlocks: string[] = [];
    return compiler.decompileBlocksSnippetAsync(hintContent, blocksInfo)
        .then((resp) => {
            const blocksXml = resp.outfiles["main.blocks"];
            const headless = pxt.blocks.loadWorkspaceXml(blocksXml);
            const allBlocks = headless.getAllBlocks();
            tutorialBlocks = allBlocks.map(b => b.type);
            return tutorialBlocks;
        });
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