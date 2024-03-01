import { logError } from "../services/loggingService";
import { runValidatorPlanAsync } from "../services/makecodeEditorService";
import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { getCatalogCriteriaWithId } from "../state/helpers";
import { CriteriaEvaluationResult, CriteriaInstance } from "../types/criteria";
import { ErrorCode } from "../types/errorCode";
import { makeToast } from "../utils";
import { showToast } from "./showToast";
import { setActiveTab } from "./setActiveTab";
import jp from "jsonpath";

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

    // Fill in parameters.
    for (const param of criteriaInstance.params ?? []) {
        const catalogParam = catalogCriteria.params?.find(p => p.name === param.name);
        if (!catalogParam) {
            logError(ErrorCode.evalMissingCatalogParameter, "Attempting to evaluate criteria with unrecognized parameter", {catalogId: criteriaInstance.catalogCriteriaId, paramName: param.name});
            return undefined;
        }

        if (!param.value) {
            // User didn't set a value for the parameter.
            logError(ErrorCode.evalParameterUnset, "Attempting to evaluate criteria with unset parameter value", {catalogId: criteriaInstance.catalogCriteriaId, paramName: param.name});
            showToast(makeToast("error", lf("Unable to evaluate criteria: missing value for {0} in {1}", param.name, catalogCriteria.template)));
        }

        jp.apply(plan, catalogParam.path, () => param.value);
    }

    return plan;
}

export async function runEvaluateAsync(fromUserInteraction: boolean) {
    const { state: teacherTool, dispatch } = stateAndDispatch();

    if (fromUserInteraction) {
        setActiveTab("results");
    }

    // Clear all existing results.
    dispatch(Actions.clearAllEvalResults());

    // EvalRequest promises will resolve to true if evaluation completed successfully (regarless of pass/fail).
    // They will only resolve to false if evaluation was unable to complete.
    const evalRequests = teacherTool.rubric.criteria.map(
        criteriaInstance =>
            new Promise(async resolve => {
                dispatch(Actions.setEvalResult(criteriaInstance.instanceId, CriteriaEvaluationResult.InProgress));

                const loadedValidatorPlans = teacherTool.validatorPlans;
                if (!loadedValidatorPlans) {
                    logError(ErrorCode.validatorPlansNotFound, "Attempting to evaluate criteria without any plans");
                    dispatch(Actions.clearEvalResult(criteriaInstance.instanceId));
                    return resolve(false);
                }

                const plan = generateValidatorPlan(criteriaInstance);

                if (!plan) {
                    dispatch(Actions.clearEvalResult(criteriaInstance.instanceId));
                    return resolve(false);
                }

                const planResult = await runValidatorPlanAsync(plan, loadedValidatorPlans);

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

    if (evalRequests.length === 0) {
        return;
    }

    const results = await Promise.all(evalRequests);
    const errorCount = results.filter(r => !r).length;
    if (errorCount === teacherTool.rubric.criteria.length) {
        showToast(makeToast("error", lf("Unable to run evaluation")));
    } else if (errorCount > 0) {
        showToast(makeToast("error", lf("Unable to evaluate some criteria")));
    }
}
