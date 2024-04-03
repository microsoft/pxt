import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { EvaluationStatus } from "../types/criteria";

export function setEvalResultFull(criteriaId: string, outcome?: EvaluationStatus, notes?: string) {
    const { state: teacherTool, dispatch } = stateAndDispatch();

    const newCriteriaEvalResult = {...teacherTool.evalResults[criteriaId]};
    if (outcome !== undefined) {
        newCriteriaEvalResult.result = outcome;
    }
    if (notes !== undefined) {
        newCriteriaEvalResult.notes = notes;
    }

    dispatch(Actions.setEvalResult(criteriaId, newCriteriaEvalResult));
}
