import { logError } from "../services/loggingService";
import { runEvalInEditorAsync } from "../services/makecodeEditorService";
import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { getCatalogCriteriaWithId } from "../state/helpers";
import { ErrorCode } from "../types/errorCode";
import { makeNotification } from "../utils";
import { postNotification } from "./postNotification";

function generateValidatorPlans(): pxt.blocks.ValidatorPlanWithId[] {
    const { state: teacherTool } = stateAndDispatch();

    const validatorPlans: pxt.blocks.ValidatorPlanWithId[] = [];
    for (const criteriaInstance of teacherTool.selectedCriteria) {
        const catalogCriteria = getCatalogCriteriaWithId(criteriaInstance.catalogCriteriaId);
        if (!catalogCriteria) {
            logError(ErrorCode.evalMissingCriteria, "Attempting to evaluate criteria with unrecognized id", { id: criteriaInstance.catalogCriteriaId })
            continue;
        }

        const plan = teacherTool.validatorPlans?.find(plan => plan.name === catalogCriteria.use);
        if (!plan) {
            logError(ErrorCode.evalMissingPlan, "Attempting to evaluate criteria with unrecognized plan", { plan: catalogCriteria.use })
            continue;
        }

        // TODO: Fill in any parameters. Error if parameters are missing.

        const planWithId = {
            ...plan,
            id: criteriaInstance.instanceId
        } as pxt.blocks.ValidatorPlanWithId;

        validatorPlans.push(planWithId);
    }

    return validatorPlans;
}

export async function runEvaluateAsync() {
    const { dispatch } = stateAndDispatch();

    const validatorPlans = generateValidatorPlans();
    const serializedPlans = JSON.stringify(validatorPlans);

    const evalResult = await runEvalInEditorAsync(serializedPlans);

    if (evalResult) {
        dispatch(Actions.setEvalResult(evalResult));
    } else {
        // Errors already logged in the runEvalInEditorAsync function.
        // Just notify the user.
        postNotification(makeNotification(lf("Unable to evaluate project"), 2000));
    }
}
