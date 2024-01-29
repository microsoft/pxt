namespace pxt.blocks {
    export async function runValidatorPlanAsync(usedBlocks: Blockly.Block[], plan: ValidatorPlan): Promise<boolean> {
        // Each plan can have multiple checks it needs to run.
        // Run all of them in parallel, and then check if the number of successes is greater than the specified threshold.
        // TBD if it's faster to run in parallel without short-circuiting once the threshold is reached, or if it's faster to run sequentially and short-circuit.
        const startTime = Date.now();

        const checkRuns = pxt.Util.promisePoolAsync(4, plan.checks, async (check: ValidatorCheckBase): Promise<boolean> => {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10000 + 5000));
            switch (check.validator) {
                case "blocksExist":
                    return runBlocksExistValidation(usedBlocks, check as BlocksExistValidatorCheck);

                default:
                    console.error(`Unrecognized validator: ${check.validator}`);
                    return false;
            }
        });

        const results = await checkRuns;
        const successCount = results.filter((r) => r).length;

        pxt.tickEvent("validation.evaluation_complete", {
            plan: plan.name,
            durationMs: Date.now() - startTime,
            passed: `${successCount >= plan.threshold}`,
        });

        return successCount >= plan.threshold;
    }

    function runBlocksExistValidation(usedBlocks: Blockly.Block[], inputs: BlocksExistValidatorCheck): boolean {
        const blockResults = validateBlocksExist({ usedBlocks, requiredBlockCounts: inputs.blockCounts });
        const success =
            blockResults.disabledBlocks.length === 0 &&
            blockResults.missingBlocks.length === 0 &&
            blockResults.insufficientBlocks.length === 0;
        return success;
    }
}
