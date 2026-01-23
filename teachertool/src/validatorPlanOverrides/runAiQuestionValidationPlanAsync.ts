import { Strings } from "../constants";
import { askCopilotQuestionAsync } from "../services/backendRequests";
import { logDebug, logError } from "../services/loggingService";
import { ErrorCode } from "../types/errorCode";

export async function runAiQuestionValidationPlanAsync(
    plan: pxt.blocks.ValidatorPlan
): Promise<pxt.blocks.EvaluationResult | undefined> {
    // Expect single aiQuestion check and nothing else.
    if (plan.checks.length !== 1 && plan.checks[0].validator !== "aiQuestion") {
        logError(ErrorCode.invalidValidatorPlan, { planName: plan.name, checks: plan.checks });
        return undefined;
    }

    const inputs = plan.checks[0] as pxt.blocks.AiQuestionValidatorCheck;
    logDebug(`Asking question: '${inputs.question}' on project with shareId: '${inputs.shareId}'`);
    const response = await askCopilotQuestionAsync(inputs.shareId, inputs.question);
    logDebug(`Response: ${response}`);

    return {
        executionSuccess: !!response,
        result: undefined,
        notes: response,
        executionErrorMsg: response ? undefined : Strings.UnableToReachAI,
    };
}
