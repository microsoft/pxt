import { Constants, Strings } from "../constants";
import { askCopilotQuestionAsync } from "../services/backendRequests";
import { logDebug, logError } from "../services/loggingService";
import { ErrorCode } from "../types/errorCode";

export async function runAiQuestionValidationPlanAsync(
    plan: pxt.blocks.ValidatorPlan
): Promise<pxt.blocks.EvaluationResult | undefined> {
    // Expect single aiQuestion check and nothing else.
    if (plan.checks.length !== 1 || plan.checks[0].validator !== "aiQuestion") {
        logError(ErrorCode.invalidValidatorPlan, { planName: plan.name, checks: plan.checks });
        return undefined;
    }

    const inputs = plan.checks[0] as pxt.blocks.AiQuestionValidatorCheck;
    const trimmedQuestion = (inputs.question || "").trim();

    if (trimmedQuestion.length < Constants.MinAIQuestionLength) {
        logDebug(`Skipping AI validation: question below min length (${trimmedQuestion.length}/${Constants.MinAIQuestionLength}).`);
        return {
            executionSuccess: false,
            result: undefined,
            notes: undefined,
            executionErrorMsg: Strings.QuestionTooShort,
        };
    }

    logDebug(`Asking question: '${trimmedQuestion}' on project with shareId: '${inputs.shareId}'`);
    const response = await askCopilotQuestionAsync(inputs.shareId, trimmedQuestion);
    logDebug(`Response: ${response}`);

    return {
        executionSuccess: !!response,
        result: undefined,
        notes: response,
        executionErrorMsg: response ? undefined : Strings.UnableToReachAI,
    };
}
