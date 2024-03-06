/// <reference path="../../localtypings/validatorPlan.d.ts" />

import * as Blockly from "blockly";

import { validateBlockFieldValueExists } from "./validateBlockFieldValueExists";
import { validateBlocksExist } from "./validateBlocksExist";
import { validateBlocksInSetExist } from "./validateBlocksInSetExist";
import { validateBlockCommentsExist } from "./validateCommentsExist";
import { validateSpecificBlockCommentsExist } from "./validateSpecificBlockCommentsExist";
import { getNestedChildBlocks } from "./getNestedChildBlocks";

export function runValidatorPlan(usedBlocks: Blockly.Block[], plan: pxt.blocks.ValidatorPlan, planLib: pxt.blocks.ValidatorPlan[]): boolean {
    const startTime = Date.now();
    let checksSucceeded = 0;
    let successfulBlocks: Blockly.Block[] = [];

    for (const check of plan.checks) {
        let checkPassed = false;
        switch (check.validator) {
            case "blocksExist":
                [successfulBlocks, checkPassed] = [...runBlocksExistValidation(usedBlocks, check as pxt.blocks.BlocksExistValidatorCheck)];
                break;
            case "blockCommentsExist":
                checkPassed = runValidateBlockCommentsExist(usedBlocks, check as pxt.blocks.BlockCommentsExistValidatorCheck);
                break;
            case "specificBlockCommentsExist":
                checkPassed = runValidateSpecificBlockCommentsExist(usedBlocks, check as pxt.blocks.SpecificBlockCommentsExistValidatorCheck);
                break;
            case "blocksInSetExist":
                [successfulBlocks, checkPassed] = [...runBlocksInSetExistValidation(usedBlocks, check as pxt.blocks.BlocksInSetExistValidatorCheck)];
                break;
            case "blockFieldValueExists":
                [successfulBlocks, checkPassed] = [...runBlockFieldValueExistsValidation(usedBlocks, check as pxt.blocks.BlockFieldValueExistsCheck)];
                break;
            default:
                pxt.debug(`Unrecognized validator: ${check.validator}`);
                checkPassed = false;
                break;
        }

        if (checkPassed && check.childValidatorPlans) {
            for (const planName of check.childValidatorPlans) {
                let timesPassed = 0;
                for (const parentBlock of successfulBlocks) {
                    const blocksToUse = getNestedChildBlocks(parentBlock);
                    const childPlan = planLib.find((plan) => plan.name === planName);
                    const childPassed = runValidatorPlan(blocksToUse, childPlan, planLib);
                    timesPassed += childPassed ? 1 : 0;
                }
                checkPassed = checkPassed && timesPassed > 0;
            }
        }
        checksSucceeded += checkPassed ? 1 : 0;
    }

    const passed = checksSucceeded >= plan.threshold;

    pxt.tickEvent("validation.evaluation_complete", {
        plan: plan.name,
        durationMs: Date.now() - startTime,
        passed: `${passed}`,
    });

    return passed;
}

function runBlocksExistValidation(usedBlocks: Blockly.Block[], inputs: pxt.blocks.BlocksExistValidatorCheck): [Blockly.Block[], boolean] {
    const requiredBlockCounts = inputs.blockCounts.reduce((acc, info) => {
        acc[info.blockId] = info.count;
        return acc;
    }, {} as pxt.Map<number>);
    const blockResults = validateBlocksExist({ usedBlocks, requiredBlockCounts });
    let successfulBlocks: Blockly.Block[] = [];
    if (blockResults.passed) {
        for (const blockCount of inputs.blockCounts) {
            const blockId = blockCount.blockId;
            successfulBlocks.push(...blockResults.successfulBlocks[blockId]);
        }
    }
    return [successfulBlocks, blockResults.passed];
}

function runValidateBlockCommentsExist(usedBlocks: Blockly.Block[], inputs: pxt.blocks.BlockCommentsExistValidatorCheck): boolean {
    const blockResults = validateBlockCommentsExist({ usedBlocks, numRequired: inputs.count });
    return blockResults.passed;
}

function runValidateSpecificBlockCommentsExist(usedBlocks: Blockly.Block[], inputs: pxt.blocks.SpecificBlockCommentsExistValidatorCheck): boolean {
    const blockResults = validateSpecificBlockCommentsExist({ usedBlocks, blockType: inputs.blockType });
    return blockResults.passed;
}

function runBlocksInSetExistValidation(usedBlocks: Blockly.Block[], inputs: pxt.blocks.BlocksInSetExistValidatorCheck): [Blockly.Block[], boolean] {
    const blockResults = validateBlocksInSetExist({ usedBlocks, blockIdsToCheck: inputs.blocks, count: inputs.count });
    return  [blockResults.successfulBlocks, blockResults.passed];
}

function runBlockFieldValueExistsValidation(usedBlocks: Blockly.Block[], inputs: pxt.blocks.BlockFieldValueExistsCheck): [Blockly.Block[], boolean] {
    const blockResults = validateBlockFieldValueExists({
        usedBlocks,
        fieldType: inputs.fieldType,
        fieldValue: inputs.fieldValue,
        specifiedBlock: inputs.blockType
    });
    return  [blockResults.successfulBlocks, blockResults.passed];
}
