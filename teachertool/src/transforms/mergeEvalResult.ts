import { stateAndDispatch } from "../state";
import { EvaluationStatus } from "../types/criteria";
import { setEvalResult } from "./setEvalResult";

// This will set the outcome and notes for a given criteria instance id, but if the provided value is undefined, it will not change that value.
export function mergeEvalResult(criteriaInstanceId: string, outcome?: EvaluationStatus, notes?: string) {
    const { state: teacherTool, dispatch } = stateAndDispatch();

    const newCriteriaEvalResult = {...teacherTool.evalResults[criteriaInstanceId]};
    if (outcome !== undefined) {
        newCriteriaEvalResult.result = outcome;
    }
    if (notes !== undefined) {
        newCriteriaEvalResult.notes = notes;
    }

    setEvalResult(criteriaInstanceId, newCriteriaEvalResult);
}
