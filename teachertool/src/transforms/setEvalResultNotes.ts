import { stateAndDispatch } from "../state";
import { setEvalResult } from "./setEvalResult";

// This will set the notes for a given criteria instance id. If notes is undefined, it will clear them.
export function setEvalResultNotes(criteriaId: string, notes: string) {
    const { state: teacherTool, dispatch } = stateAndDispatch();

    const newCriteriaEvalResult = {
        ...teacherTool.evalResults[criteriaId],
        notes,
    };

    setEvalResult(criteriaId, newCriteriaEvalResult);
}
