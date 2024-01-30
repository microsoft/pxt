import { logError } from "../services/loggingService";
import { runValidatorPlanAsync } from "../services/makecodeEditorService";
import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { getCatalogCriteriaWithId } from "../state/helpers";
import { CriteriaEvaluationResult, CriteriaInstance } from "../types/criteria";
import { ErrorCode } from "../types/errorCode";
import { makeNotification } from "../utils";
import { postNotification } from "./postNotification";

function generateValidatorPlan(criteriaInstance: CriteriaInstance): pxt.blocks.ValidatorPlan | undefined {
    const { state: teacherTool } = stateAndDispatch();

    const catalogCriteria = getCatalogCriteriaWithId(criteriaInstance.catalogCriteriaId);
    if (!catalogCriteria) {
        logError(ErrorCode.evalMissingCriteria, "Attempting to evaluate criteria with unrecognized catalog id", {
            id: criteriaInstance.catalogCriteriaId,
        });
        return undefined;
    }

    const plan = teacherTool.validatorPlans?.find(plan => plan.name === catalogCriteria.use);
    if (!plan) {
        logError(ErrorCode.evalMissingPlan, "Attempting to evaluate criteria with unrecognized plan", {
            plan: catalogCriteria.use,
        });
        return undefined;
    }

    // TODO: Fill in any parameters. Error if parameters are missing.

    return plan;
}

export async function runEvaluateAsync() {
    const { state: teacherTool, dispatch } = stateAndDispatch();

    // Clear all existing results.
    dispatch(Actions.clearAllEvalResults());

    // EvalRequest promises will resolve to true if evaluation completed successfully (regarless of pass/fail).
    // They will only resolve to false if evaluation was unable to complete.
    const evalRequests = teacherTool.selectedCriteria.map(
        criteriaInstance =>
            new Promise(async resolve => {
                dispatch(Actions.setEvalResult(criteriaInstance.instanceId, CriteriaEvaluationResult.InProgress));

                const plan = generateValidatorPlan(criteriaInstance);

                if (!plan) {
                    dispatch(Actions.clearEvalResult(criteriaInstance.instanceId));
                    return resolve(false);
                }

                const planResult = await runValidatorPlanAsync(plan);

                if (planResult) {
                    dispatch(
                        Actions.setEvalResult(
                            criteriaInstance.instanceId,
                            planResult.result ? CriteriaEvaluationResult.Pass : CriteriaEvaluationResult.Fail
                        )
                    );
                    return resolve(true); // evaluation completed successfully, so return true (regardless of pass/fail)
                } else {
                    dispatch(Actions.clearEvalResult(criteriaInstance.instanceId));
                    return resolve(false);
                }
            })
    );

    const results = await Promise.all(evalRequests);
    const errorCount = results.filter(r => !r).length;
    if (errorCount === teacherTool.selectedCriteria.length) {
        postNotification(makeNotification(lf("Unable to run evaluation"), 2000));
    } else if (errorCount > 0) {
        postNotification(makeNotification(lf("Unable to evaluate some criteria"), 2000));
    }
}
