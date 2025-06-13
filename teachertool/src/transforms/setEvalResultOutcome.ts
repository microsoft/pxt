import { stateAndDispatch } from "../state";
import { EvaluationStatus } from "../types/criteria";
import { setEvalResult } from "./setEvalResult";

// This will set the outcome for a given criteria instance id. If result is undefined, it will clear it.
export function setEvalResultOutcome(criteriaId: string, result: EvaluationStatus, isManual: boolean) {
    const { state: teacherTool } = stateAndDispatch();

    const newCriteriaEvalResult = {
        ...teacherTool.evalResults[criteriaId],
        result,
        resultIsManual: isManual,
    };

    setEvalResult(criteriaId, newCriteriaEvalResult);
}
