/// <reference path="../../localtypings/validatorPlan.d.ts" />

import { validateBlocksExist } from "./validateBlocksExist";
import { validateBlocksInSetExist } from "./validateBlocksInSetExist";
import { validateBlockCommentsExist } from "./validateCommentsExist";
import { validateSpecificBlockCommentsExist } from "./validateSpecificBlockCommentsExist";

const maxConcurrentChecks = 4;

export async function runValidatorPlanAsync(
  usedBlocks: Blockly.Block[],
  plan: pxt.blocks.ValidatorPlan
): Promise<boolean> {
  // Each plan can have multiple checks it needs to run.
  // Run all of them in parallel, and then check if the number of successes is greater than the specified threshold.
  // TBD if it's faster to run in parallel without short-circuiting once the threshold is reached, or if it's faster to run sequentially and short-circuit.
  const startTime = Date.now();

  const checkRuns = pxt.Util.promisePoolAsync(
    maxConcurrentChecks,
    plan.checks,
    async (check: pxt.blocks.ValidatorCheckBase): Promise<boolean> => {
      switch (check.validator) {
        case "blocksExist":
          return runBlocksExistValidation(
            usedBlocks,
            check as pxt.blocks.BlocksExistValidatorCheck
          );
        case "blockCommentsExist":
          return runValidateBlockCommentsExist(
            usedBlocks,
            check as pxt.blocks.BlockCommentsExistValidatorCheck
          );
        case "specificBlockCommentsExist":
          return runValidateSpecificBlockCommentsExist(
            usedBlocks,
            check as pxt.blocks.SpecificBlockCommentsExistValidatorCheck
          );
        case "blocksInSetExist":
          return runBlocksInSetExistValidation(
            usedBlocks,
            check as pxt.blocks.BlocksInSetExistValidatorCheck
          );
        case "aiQuestion":
          return runAiQuestionValidation(
            check as pxt.blocks.AiQuestionValidatorCheck
          );
        default:
          pxt.debug(`Unrecognized validator: ${check.validator}`);
          return false;
      }
    }
  );

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

function runBlocksExistValidation(
  usedBlocks: Blockly.Block[],
  inputs: pxt.blocks.BlocksExistValidatorCheck
): boolean {
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
  inputs: pxt.blocks.AiQuestionValidatorCheck
): Promise<boolean> {
    // TODO thsparks - remove debug logs.
    console.log(`Asking question: '${inputs.question}'`);

  const data = {
    query: inputs.question,
    intent: "makecode_evaluation",
    context: {
      share_id: "_bwCXLsXHjfvK",
      target: "microbit",
    },
  };

  // Send a post request to deep prompt endpoint to get the response.
  const initialRequest = await fetch(
    "http://127.0.0.1:5000/api/v1/query_async",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );

  const requestStatusInfo = await initialRequest.json();

  if (!requestStatusInfo) {
    throw new Error("Failed to get response from deep prompt.");
  }

  const result_id = requestStatusInfo.result_id;
  if (!result_id) {
    throw new Error("No result id returned from deep prompt.");
  }

    // Poll for response
    // TODO thsparks - timeout?
    let response;
    while (!response) {
        const pollResponse = await fetch(`http://127.0.0.1:5000/api/v1/result/${result_id}`);
        const pollData = await pollResponse.json();

        if (pollData.executed === true) {
            response = pollData;
        } else {
            // Wait for a bit before polling again to avoid spamming the server
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    if (!response.successful) {
        // TODO thsparks - can we get more info?
        throw new Error("AI was unable to complete the request.");
    }

    console.log(`Response: ${response.response_text}`)

  return true;
}
