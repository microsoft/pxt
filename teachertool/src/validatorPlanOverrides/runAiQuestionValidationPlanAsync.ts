import { Strings, Constants } from "../constants";
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
    
    // Validate question length
    const question = (inputs.question || "").trim();
    if (question.length < Constants.MinAIQuestionLength) {
        logDebug(`Question too short: '${question}' (length: ${question.length}, minimum: ${Constants.MinAIQuestionLength})`);
        const errorMsg = Strings.QuestionTooShort.replace("{0}", Constants.MinAIQuestionLength.toString());
        return {
            executionSuccess: false,
            result: undefined,
            notes: undefined,
            executionErrorMsg: errorMsg,
        };
    }
    
    logDebug(`Asking question: '${question}' on project with shareId: '${inputs.shareId}'`);
    const response = await askCopilotQuestionAsync(inputs.shareId, question);
    logDebug(`Response: ${response}`);

    return {
        executionSuccess: !!response,
        result: undefined,
        notes: response,
        executionErrorMsg: response ? undefined : Strings.UnableToReachAI,
    };
}
