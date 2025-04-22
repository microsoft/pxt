import { Ticks } from "../constants";
import { logError } from "../services/loggingService";
import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { getCriteriaInstanceWithId } from "../state/helpers";
import { CriteriaResult, EvaluationStatus } from "../types/criteria";
import { ErrorCode } from "../types/errorCode";

// Send tick events related to changes happening in the criteria result.
function reportChanges(criteriaId: string, result: CriteriaResult) {
    const { state: teacherTool } = stateAndDispatch();

    const previousResult = teacherTool.evalResults[criteriaId];
    const criteriaInstance = getCriteriaInstanceWithId(teacherTool, criteriaId);

    if (previousResult?.result != result?.result) {
        pxt.tickEvent(Ticks.SetEvalResultOutcome, {
            catalogCriteriaId: criteriaInstance?.catalogCriteriaId ?? "",
            newValue: EvaluationStatus[result.result],
            oldValue: previousResult?.result ? EvaluationStatus[previousResult.result] : "",
            newValueIsManual: result?.resultIsManual + "",
            oldValueIsManual: previousResult?.resultIsManual + "",
        });
    }

    if (previousResult?.notes != result?.notes) {
        // Setting notes is debounced so this isn't too noisy.
        pxt.tickEvent(Ticks.SetEvalResultNotes, {
            catalogCriteriaId: criteriaInstance?.catalogCriteriaId ?? "",
            newLength: result?.notes?.length ?? 0,
            oldLength: previousResult?.notes?.length ?? 0,
        });
    }
}

export function setEvalResult(criteriaId: string, result: CriteriaResult) {
    const { dispatch } = stateAndDispatch();
    reportChanges(criteriaId, result);
    dispatch(Actions.setEvalResult(criteriaId, result));
}
