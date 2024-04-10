import { runAiQuestionValidationPlanAsync } from "./runAiQuestionValidationPlanAsync";

// This allows the teacher tool to override validation for any validator plans (instead of calling into the iframe).
// It will return the result of the override if one is found.
// If there is no override for the plan, it will return undefined.
export async function runValidatorPlanOverrideAsync(
    plan: pxt.blocks.ValidatorPlan
): Promise<pxt.blocks.EvaluationResult | undefined> {
    switch (plan.name) {
        case "ai_question":
            return await runAiQuestionValidationPlanAsync(plan);
        default:
            return undefined; // No override
    }
}
