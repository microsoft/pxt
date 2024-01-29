namespace pxt.blocks {
    export async function runValidatorPlan(usedBlocks: Blockly.Block[], plan: ValidatorPlan): Promise<boolean> {
        // Each plan can have multiple checks it needs to run.
        // Run all of them in parallel, and then check if the number of successes is greater than the specified threshold.
        // TBD if it's faster to run in parallel without short-circuiting once the threshold is reached, or if it's faster to run sequentially and short-circuit.
        const startTime = Date.now();
        const checkRuns = plan.checks.map(
            (check) =>
                new Promise<boolean>(async (resolve) => {
                    switch (check.validator) {
                        case "blocksExist":
                            const result = runBlocksExistValidation(usedBlocks, check as BlocksExistValidatorCheck);
                            resolve(result);
                            break;

                        default:
                            console.error(`Unrecognized validator: ${check.validator}`);
                            resolve(false);
                    }
                })
        );

        const results = await Promise.all(checkRuns);
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
