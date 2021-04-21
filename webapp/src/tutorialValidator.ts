/// <reference path="../../built/pxtlib.d.ts" />

import * as compiler from "./compiler";

export enum TutorialCodeStatus {
    Unknown = "Unknown",
    Invalid = "Invalid",
    Valid = "Valid"
}


// Takes in the tutorial steps and user's source code in XML
// Returns TutorialCode Status
export function validate(step: pxt.tutorial.TutorialStepInfo, source: string, blocks: Blockly.Block[], blockinfo: pxtc.BlocksInfo): string {

    // Checks to make sure 
    if (blocks.length > 0) {
        let blockTypes: string[] = blocks.map(b => b.type);
        let tutorialType: string[] = tutorialBlockList(step, blockinfo);

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
    for(let i: number = 0; i < arrayCount.length; i++) {
        if (!count[i]) {
            count[i] = 0;
        }
        count[i] = count[i] + 1;
    }
    return count;
}

// Takes in the tutorial steps and returns an array of key words 
function tutorialBlockList(step: pxt.tutorial.TutorialStepInfo, blocksInfo: pxtc.BlocksInfo): string[] {
    let hintContent = step.hintContentMd;
    let tutorialBlocks: string[] = [];
    compiler.decompileBlocksSnippetAsync(hintContent, blocksInfo)
        .then((resp) => {
            const blocksXml = resp.outfiles["main.blocks"];
            const headless = pxt.blocks.loadWorkspaceXml(blocksXml);
            const allBlocks = headless.getAllBlocks();
            tutorialBlocks = allBlocks.map(b => b.type);
        });
    return tutorialBlocks;
}

// Takes in a map of the user's code and map of tutorial's code
// returns false if the user used less blocks than tutorials, true otherwise
function validateNumberOfBlocks(usersBlockUsed: pxt.Map<number>, tutorialBlockUsed: pxt.Map<number>): boolean {
    for (let i: number = 0; i < usersBlockUsed.size; i++) {
        if (tutorialBlockUsed[i]) {
            if (usersBlockUsed[i] < tutorialBlockUsed[i]) {
                return false;
            }
        }
    }
    return true;
}


