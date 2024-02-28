import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { CriteriaEvaluationResult } from "../types/criteria";

export function setEvalResultOutcome(criteriaId: string, result: CriteriaEvaluationResult) {
    const { state: teacherTool, dispatch } = stateAndDispatch();

    const newCriteriaEvalResult = {
        ...teacherTool.evalResults[criteriaId],
        result
    };
    dispatch(Actions.setEvalResult(criteriaId, newCriteriaEvalResult));
}