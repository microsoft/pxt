/// <reference path="../../localtypings/validatorPlan.d.ts" />

import { validateBlocksExist } from "./validateBlocksExist";
import { validateBlocksInSetExist } from "./validateBlocksInSetExist";
import { validateBlockCommentsExist } from "./validateCommentsExist";
import { validateSpecificBlockCommentsExist } from "./validateSpecificBlockCommentsExist";

export function runValidatorPlan(usedBlocks: Blockly.Block[], plan: pxt.blocks.ValidatorPlan, planBank: pxt.blocks.ValidatorPlan[]): boolean {
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
            default:
                pxt.debug(`Unrecognized validator: ${check.validator}`);
                checkPassed = false;
                break;
        }

        if (checkPassed && check.childValidatorPlans) {
            for (const planName of check.childValidatorPlans) {
                let timesPassed = 0;
                for (const parentBlock of successfulBlocks) {
                    const blocksToUse = parentBlock.getChildren(true);
                    const childPlan = planBank.find((plan) => plan.name === planName);
                    const childPassed = runValidatorPlan(blocksToUse, childPlan, planBank);
                    timesPassed += childPassed ? 1 : 0;
                }
                checkPassed = timesPassed > 0;
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
    const blockResults = validateBlocksExist({ usedBlocks, requiredBlockCounts: inputs.blockCounts });
    const blockId = Object.keys(inputs.blockCounts)[0];
    const successfulBlocks = blockResults.successfulBlocks.length ? blockResults.successfulBlocks[0][blockId] : [];
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