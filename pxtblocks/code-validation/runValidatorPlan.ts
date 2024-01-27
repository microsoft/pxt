namespace pxt.blocks {
  export async function runValidatorPlan(usedBlocks: Blockly.Block[], plan: ValidatorPlan): Promise<boolean> {
    const checkRuns = plan.checks.map(
      (check) =>
        new Promise<boolean>(async (resolve) => {
          switch (check.validator) {
            case "blocksExist":
              const blockExistsCheck = check as BlocksExistValidatorCheck;
              const blockResults = validateBlocksExist({
                usedBlocks,
                requiredBlockCounts: blockExistsCheck.blockCounts,
              });
              const success =
                blockResults.disabledBlocks.length === 0 &&
                blockResults.missingBlocks.length === 0 &&
                blockResults.insufficientBlocks.length === 0;
              resolve(success);
              break;
            default:
              console.error(`Unrecognized validator: ${check.validator}`);
              break;
          }
          resolve(false);
        })
    );

    const results = await Promise.all(checkRuns);
    const successCount = results.filter((r) => r).length;
    return successCount >= plan.threshold;
  }
}
