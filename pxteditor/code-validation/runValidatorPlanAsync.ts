/// <reference path="../../localtypings/validatorPlan.d.ts" />

import { validateBlocksExist } from "./validateBlocksExist";
import { validateBlocksInSetExist } from "./validateBlocksInSetExist";
import { validateBlockCommentsExist } from "./validateCommentsExist";
import { validateSpecificBlockCommentsExist } from "./validateSpecificBlockCommentsExist";

const maxConcurrentChecks = 4;

export async function runValidatorPlanAsync(
    shareId: string,
    target: string,
    usedBlocks: Blockly.Block[],
    plan: pxt.blocks.ValidatorPlan
): Promise<pxt.blocks.EvaluationResult> {
    // Each plan can have multiple checks it needs to run.
    // Run all of them in parallel, and then check if the number of successes is greater than the specified threshold.
    // TBD if it's faster to run in parallel without short-circuiting once the threshold is reached, or if it's faster to run sequentially and short-circuit.
    const startTime = Date.now();

    const checkRuns = pxt.Util.promisePoolAsync(
        maxConcurrentChecks,
        plan.checks,
        async (check: pxt.blocks.ValidatorCheckBase): Promise<pxt.blocks.EvaluationResult> => {
            let success: boolean | undefined = undefined;
            let notes: string | undefined = undefined;
            switch (check.validator) {
                case "blocksExist":
                    success = runBlocksExistValidation(usedBlocks, check as pxt.blocks.BlocksExistValidatorCheck);
                    break;
                case "blockCommentsExist":
                    success = runValidateBlockCommentsExist(
                        usedBlocks,
                        check as pxt.blocks.BlockCommentsExistValidatorCheck
                    );
                    break;
                case "specificBlockCommentsExist":
                    success = runValidateSpecificBlockCommentsExist(
                        usedBlocks,
                        check as pxt.blocks.SpecificBlockCommentsExistValidatorCheck
                    );
                    break;
                case "blocksInSetExist":
                    success = runBlocksInSetExistValidation(
                        usedBlocks,
                        check as pxt.blocks.BlocksInSetExistValidatorCheck
                    );
                    break;
                case "aiQuestion":
                    notes = await runAiQuestionValidation(
                        shareId,
                        target,
                        check as pxt.blocks.AiQuestionValidatorCheck
                    );
                    break;
                default:
                    pxt.debug(`Unrecognized validator: ${check.validator}`);
            }

            let result = 2;
            if (success === true) {
                result = 0;
            } else if (success === false) {
                result = 1;
            }

            return { result, notes };
        }
    );

    const results = await checkRuns;
    const successCount = results.filter((r) => r.result === 0).length;
    const hasNotApplicable =
        results.filter((r) => r.result === 2).length > 0;
    const passed = successCount >= plan.threshold;

    // todo thsparks - how to actually combine these?
    const notes = results.map((r) => r.notes).join("\n");

    pxt.tickEvent("validation.evaluation_complete", {
        plan: plan.name,
        durationMs: Date.now() - startTime,
        hasNotApplicable: `${hasNotApplicable}`,
        passed: `${passed}`,
    });

    return {
        result: hasNotApplicable
            ? 2
            : passed
            ? 0
            : 1,
        notes,
    };
}

function runBlocksExistValidation(usedBlocks: Blockly.Block[], inputs: pxt.blocks.BlocksExistValidatorCheck): boolean {
    const blockResults = validateBlocksExist({
        usedBlocks,
        requiredBlockCounts: inputs.blockCounts,
    });
    const success =
        blockResults.disabledBlocks.length === 0 &&
        blockResults.missingBlocks.length === 0 &&
        blockResults.insufficientBlocks.length === 0;
    return success;
}

function runValidateBlockCommentsExist(
    usedBlocks: Blockly.Block[],
    inputs: pxt.blocks.BlockCommentsExistValidatorCheck
): boolean {
    const blockResults = validateBlockCommentsExist({
        usedBlocks,
        numRequired: inputs.count,
    });
    return blockResults.passed;
}

function runValidateSpecificBlockCommentsExist(
    usedBlocks: Blockly.Block[],
    inputs: pxt.blocks.SpecificBlockCommentsExistValidatorCheck
): boolean {
    const blockResults = validateSpecificBlockCommentsExist({
        usedBlocks,
        blockType: inputs.blockType,
    });
    return blockResults.passed;
}

function runBlocksInSetExistValidation(
    usedBlocks: Blockly.Block[],
    inputs: pxt.blocks.BlocksInSetExistValidatorCheck
): boolean {
    const blockResults = validateBlocksInSetExist({
        usedBlocks,
        blockIdsToCheck: inputs.blocks,
        count: inputs.count,
    });
    return blockResults.passed;
}

async function runAiQuestionValidation(
    shareId: string,
    target: string,
    inputs: pxt.blocks.AiQuestionValidatorCheck
): Promise<string> {
    // TODO thsparks - remove debug logs.
    console.log(`Asking question: '${inputs.question}'`);

    const data = {
        query: inputs.question,
        intent: "makecode_evaluation",
        context: {
            share_id: shareId,
            target: target,
        },
    };

    // Send a post request to deep prompt endpoint to get the response.
    console.log("Sending request with data " + JSON.stringify(data));
    const request = await fetch("http://127.0.0.1:5000/api/v1/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });

    const response = await request.json();

    if (!response) {
        throw new Error("Failed to get response from deep prompt.");
    }

    console.log(`Response: ${response.response_text}`);

    return response.response_text;
}
