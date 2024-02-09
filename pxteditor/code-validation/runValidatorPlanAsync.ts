/// <reference path="../../localtypings/validatorPlan.d.ts" />

import { validateBlocksExist } from "./validateBlocksExist";
import { validateBlocksInSetExist } from "./validateBlocksInSetExist";
import { validateBlockCommentsExist } from "./validateCommentsExist";
import { validateSpecificBlockCommentsExist } from "./validateSpecificBlockCommentsExist";

const maxConcurrentChecks = 4;


export function runValidatorPlanAsync(usedBlocks: Blockly.Block[], plan: pxt.blocks.ValidatorPlan, planBank: pxt.blocks.ValidatorPlan[]): boolean {
    // Each plan can have multiple checks it needs to run.
    // Run all of them in parallel, and then check if the number of successes is greater than the specified threshold.
    // TBD if it's faster to run in parallel without short-circuiting once the threshold is reached, or if it's faster to run sequentially and short-circuit.
    const startTime = Date.now();
    let checksSucceeded = 0;

    for (const check of plan.checks) {
        let checkResult = false;
        switch (check.validator) {
            case "blocksExist":
                checkResult = runBlocksExistValidation(usedBlocks, check as pxt.blocks.BlocksExistValidatorCheck);
                break;
            case "blockCommentsExist":
                checkResult = runValidateBlockCommentsExist(usedBlocks, check as pxt.blocks.BlockCommentsExistValidatorCheck);
                break;
            case "specificBlockCommentsExist":
                checkResult = runValidateSpecificBlockCommentsExist(usedBlocks, check as pxt.blocks.SpecificBlockCommentsExistValidatorCheck);
                break;
            case "blocksInSetExist":
                checkResult = runBlocksInSetExistValidation(usedBlocks, check as pxt.blocks.BlocksInSetExistValidatorCheck);
                break;
            default:
                pxt.debug(`Unrecognized validator: ${check.validator}`);
                checkResult = false;
                break;
        }

        if (checkResult && check.childValidatorPlans) {
            for (const planName of check.childValidatorPlans) {
                const childPlan = planBank.find((plan) => plan.name === planName);
                const childResult = runValidatorPlanAsync(usedBlocks, childPlan, planBank);
                checkResult = checkResult && childResult;
            }
        }
        checksSucceeded += checkResult ? 1 : 0;
    }

    const passed = checksSucceeded >= plan.threshold;

    pxt.tickEvent("validation.evaluation_complete", {
        plan: plan.name,
        durationMs: Date.now() - startTime,
        passed: `${passed}`,
    });

    return passed;
}

function runBlocksExistValidation(usedBlocks: Blockly.Block[], inputs: pxt.blocks.BlocksExistValidatorCheck): boolean {
    const blockResults = validateBlocksExist({ usedBlocks, requiredBlockCounts: inputs.blockCounts });
    const success =
        blockResults.disabledBlocks.length === 0 &&
        blockResults.missingBlocks.length === 0 &&
        blockResults.insufficientBlocks.length === 0;
    return success;
}

function runValidateBlockCommentsExist(usedBlocks: Blockly.Block[], inputs: pxt.blocks.BlockCommentsExistValidatorCheck): boolean {
    const blockResults = validateBlockCommentsExist({ usedBlocks, numRequired: inputs.count });
    return blockResults.passed;
}

function runValidateSpecificBlockCommentsExist(usedBlocks: Blockly.Block[], inputs: pxt.blocks.SpecificBlockCommentsExistValidatorCheck): boolean {
    const blockResults = validateSpecificBlockCommentsExist({ usedBlocks, blockType: inputs.blockType });
    return blockResults.passed;
}

function runBlocksInSetExistValidation(usedBlocks: Blockly.Block[], inputs: pxt.blocks.BlocksInSetExistValidatorCheck): boolean {
    const blockResults = validateBlocksInSetExist({ usedBlocks, blockIdsToCheck: inputs.blocks, count: inputs.count });
    return blockResults.passed;
}