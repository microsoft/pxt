import { stateAndDispatch } from "../state";
import { EvaluationStatus } from "../types/criteria";
import { setEvalResult } from "./setEvalResult";
import { setUserFeedback } from "./setUserFeedback";

// This will set the outcome and notes for a given criteria instance id, but if the provided value is undefined, it will not change that value.
export function mergeEvalResult(criteriaInstanceId: string, isManual: boolean, outcome?: EvaluationStatus, notes?: string) {
    const { state: teacherTool, dispatch } = stateAndDispatch();

    const newCriteriaEvalResult = { ...teacherTool.evalResults[criteriaInstanceId] };

    // Clear any errors from the previous result.
    newCriteriaEvalResult.error = undefined;

    if (outcome !== undefined) {
        newCriteriaEvalResult.result = outcome;
        newCriteriaEvalResult.resultIsManual = isManual;
    }
    if (notes !== undefined) {
        if (newCriteriaEvalResult.notes !== notes) {
            // If the notes are changing, we should clear any user feedback.
            setUserFeedback(criteriaInstanceId, undefined);
        }
        newCriteriaEvalResult.notes = notes;
    }

    setEvalResult(criteriaInstanceId, newCriteriaEvalResult);
}
