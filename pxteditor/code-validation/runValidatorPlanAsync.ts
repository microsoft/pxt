/// <reference path="../../localtypings/validatorPlan.d.ts" />

import { validateBlocksExist } from "./validateBlocksExist";
import { validateBlocksInSetExist } from "./validateBlocksInSetExist";
import { validateBlockCommentsExist } from "./validateCommentsExist";
import { validateSpecificBlockCommentsExist } from "./validateSpecificBlockCommentsExist";

const maxConcurrentChecks = 4;

export async function runValidatorPlanAsync(usedBlocks: Blockly.Block[], plan: pxt.blocks.ValidatorPlan): Promise<boolean> {
    // Each plan can have multiple checks it needs to run.
    // Run all of them in parallel, and then check if the number of successes is greater than the specified threshold.
    // TBD if it's faster to run in parallel without short-circuiting once the threshold is reached, or if it's faster to run sequentially and short-circuit.
    const startTime = Date.now();

    const checkRuns = pxt.Util.promisePoolAsync(maxConcurrentChecks, plan.checks, async (check: pxt.blocks.ValidatorCheckBase): Promise<boolean> => {
        switch (check.validator) {
            case "blocksExist":
                return runBlocksExistValidation(usedBlocks, check as pxt.blocks.BlocksExistValidatorCheck);
            case "blockCommentsExist":
                return runValidateBlockCommentsExist(usedBlocks, check as pxt.blocks.BlockCommentsExistValidatorCheck);
            case "specificBlockCommentsExist":
                return runValidateSpecificBlockCommentsExist(usedBlocks, check as pxt.blocks.SpecificBlockCommentsExistValidatorCheck);
            case "blocksInSetExist":
                return runBlocksInSetExistValidation(usedBlocks, check as pxt.blocks.BlocksInSetExistValidatorCheck);
            case "aiQuestion":
                return runAiQuestionValidation(check as pxt.blocks.AiQuestionValidatorCheck);
            default:
                pxt.debug(`Unrecognized validator: ${check.validator}`);
                return false;
        }
    });

    const results = await checkRuns;
    const successCount = results.filter((r) => r).length;
    const passed = successCount >= plan.threshold;

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

function runAiQuestionValidation(inputs: pxt.blocks.AiQuestionValidatorCheck): boolean {
    // TODO thsparks - send question to AI and get a response.
    console.log(`Ask question: '${inputs.question}'`);
    return true;
}
