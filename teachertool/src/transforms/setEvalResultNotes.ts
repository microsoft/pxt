import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";

export function setEvalResultNotes(criteriaId: string, notes: string) {
    const { state: teacherTool, dispatch } = stateAndDispatch();

    const newCriteriaEvalResult = {
        ...teacherTool.evalResults[criteriaId],
        notes,
    };
    dispatch(Actions.setEvalResult(criteriaId, newCriteriaEvalResult));
}
