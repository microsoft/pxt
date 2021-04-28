/// <reference path="../../built/pxtlib.d.ts" />

import * as compiler from "./compiler";

export enum TutorialCodeStatus {
    Unknown = "Unknown",
    Invalid = "Invalid",
    Valid = "Valid"
}


// Takes in the tutorial steps and user's source code in XML
// Returns TutorialCode Status
export async function validate(step: pxt.tutorial.TutorialStepInfo, source: string, blocks: Blockly.Block[], blockinfo: pxtc.BlocksInfo): Promise<TutorialCodeStatus> {

    // Checks to make sure there are blocks in the workspace
    if (blocks.length > 0) {
        let blockTypes: string[] = blocks.map(b => b.type);
        let tutorialType: string[] = await tutorialBlockList(step, blockinfo);

        let usersBlockUsed: pxt.Map<number> = blockCount(blockTypes);
        let tutorialBlockUsed: pxt.Map<number> = blockCount(tutorialType);
        if (!validateNumberOfBlocks(usersBlockUsed, tutorialBlockUsed)) {
            return TutorialCodeStatus.Invalid;
        }
        return TutorialCodeStatus.Valid;
    }

    return TutorialCodeStatus.Unknown;
}

// Returns a map of block type and frequency
function blockCount(arrayCount: string[]): pxt.Map<number> {
    let count: pxt.Map<number> = {};
    for (let i: number = 0; i < arrayCount.length; i++) {
        let blockIndex = hasBlock(arrayCount, i, arrayCount[i]);
        if (blockIndex == i) {

            count[arrayCount[i]] = 0;
        }
        count[arrayCount[i]] = count[arrayCount[i]] + 1;
    }
    return count;
}

// Returns index if has block, next availble index otherwise
function hasBlock(arr: string[], index: number, val: string): number {

    for (let i: number = 0; i < index; i++) {
        if (arr[i] === val) {
            return i;
        }
    }
    return index;
}

// Takes in the tutorial steps and returns an array of key words 
function tutorialBlockList(step: pxt.tutorial.TutorialStepInfo, blocksInfo: pxtc.BlocksInfo): Promise<string[]> {
    let hintContent = step.hintContentMd;
    // Want some regex
    hintContent = hintContent.replace("\`\`\`blocks", "");
    hintContent = hintContent.replace("\`\`\`", "");
    console.log(hintContent);
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

// Takes in a map of the user's code and map of tutorial's code
// returns false if the user used less blocks than tutorials, true otherwise
function validateNumberOfBlocks(usersBlockUsed: pxt.Map<number>, tutorialBlockUsed: pxt.Map<number>): boolean {

    // Object.keys(usersBlockUsed) <- array of strings
    let userBlockKeys = Object.keys(usersBlockUsed);
    let tutorialBlockKeys = Object.keys(tutorialBlockUsed);
    // Checks if there is atleast the required number of blocks
    if (userBlockKeys.length < tutorialBlockKeys.length) {
        return false;
    }
    for (let i: number = 0; i < tutorialBlockKeys.length; i++) {
        let tutorialBlockKey = tutorialBlockKeys[i];
        if(!usersBlockUsed[tutorialBlockKey]) { // has not used blocks
            return false;
        }
        if (usersBlockUsed[tutorialBlockKey] < tutorialBlockUsed[tutorialBlockKey]) { // not enough blocks of one type
            return false;
        }
    }
    return true;
}


