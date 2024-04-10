import { logError } from "../services/loggingService";
import { runValidatorPlanAsync } from "../services/makecodeEditorService";
import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { getCatalogCriteriaWithId } from "../state/helpers";
import { EvaluationStatus, CriteriaInstance } from "../types/criteria";
import { ErrorCode } from "../types/errorCode";
import { makeToast } from "../utils";
import { showToast } from "./showToast";
import { setActiveTab } from "./setActiveTab";
import jp from "jsonpath";
import { getSystemParameter } from "../utils/getSystemParameter";
import { runValidatorPlanOverrideAsync } from "../validatorPlanOverrides/runValidatorPlanOverrideAsync";
import { setEvalResultOutcome } from "./setEvalResultOutcome";
import { mergeEvalResult } from "./mergeEvalResult";

function generateValidatorPlan(
    criteriaInstance: CriteriaInstance,
    showErrors: boolean
): pxt.blocks.ValidatorPlan | undefined {
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
            if (showErrors) {
                logError(
                    ErrorCode.evalMissingCatalogParameter,
                    "Attempting to evaluate criteria with unrecognized parameter",
                    { catalogId: criteriaInstance.catalogCriteriaId, paramName: param.name }
                );
            }
            return undefined;
        }

        if (catalogParam.type === "system" && catalogParam.key) {
            param.value = getSystemParameter(catalogParam.key, teacherTool);
            if (!param.value) {
                param.value = catalogParam.default;
            }
        }

        if (!param.value) {
            // User didn't set a value for the parameter.
            if (showErrors) {
                logError(ErrorCode.evalParameterUnset, "Attempting to evaluate criteria with unset parameter value", {
                    catalogId: criteriaInstance.catalogCriteriaId,
                    paramName: param.name,
                });
            }
            return undefined;
        }

        for (const path of catalogParam.paths) {
            jp.apply(plan, path, () => param.value);
        }
    }

    return plan;
}

export async function runEvaluateAsync(fromUserInteraction: boolean) {
    const { state: teacherTool, dispatch } = stateAndDispatch();

    if (fromUserInteraction) {
        setActiveTab("results");
    }

    // EvalRequest promises will resolve to true if evaluation completed successfully (regarless of pass/fail).
    // They will only resolve to false if evaluation was unable to complete.
    const evalRequests = teacherTool.rubric.criteria.map(
        criteriaInstance =>
            new Promise(async resolve => {

                const existingOutcome = teacherTool.evalResults[criteriaInstance.instanceId]?.result;
                if (!fromUserInteraction && existingOutcome !== undefined && existingOutcome !== EvaluationStatus.NotStarted) {
                    // The criteria has not changed since it was last evaluated, so we can skip it (unless user specifically clicked run).
                    return resolve(true);
                }

                setEvalResultOutcome(criteriaInstance.instanceId, EvaluationStatus.InProgress);

                const loadedValidatorPlans = teacherTool.validatorPlans;
                if (!loadedValidatorPlans) {
                    logError(ErrorCode.validatorPlansNotFound, "Attempting to evaluate criteria without any plans");
                    dispatch(Actions.clearEvalResult(criteriaInstance.instanceId));
                    return resolve(false);
                }

                const plan = generateValidatorPlan(criteriaInstance, fromUserInteraction);

                if (!plan) {
                    dispatch(Actions.clearEvalResult(criteriaInstance.instanceId));
                    return resolve(false);
                }

                // Only call into iframe if teacher tool has not specified an override for this plan.
                let planResult = await runValidatorPlanOverrideAsync(plan);
                if (!planResult) {
                    planResult = await runValidatorPlanAsync(plan, loadedValidatorPlans);
                }

                if (planResult) {
                    const result =
                        planResult.result === undefined
                            ? EvaluationStatus.CompleteWithNoResult
                            : planResult.result
                            ? EvaluationStatus.Pass
                            : EvaluationStatus.Fail;

                    mergeEvalResult(criteriaInstance.instanceId, result, planResult.notes);
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
    if (fromUserInteraction) {
        const errorCount = results.filter(r => !r).length;
        if (errorCount === teacherTool.rubric.criteria.length) {
            showToast(makeToast("error", lf("Unable to run evaluation")));
        } else if (errorCount > 0) {
            showToast(makeToast("error", lf("Unable to evaluate some criteria")));
        }
    }
}
