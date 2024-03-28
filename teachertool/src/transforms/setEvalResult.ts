import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { CriteriaResult } from "../types/criteria";

export function setEvalResult(criteriaId: string, result: CriteriaResult) {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.setEvalResult(criteriaId, result));
}
