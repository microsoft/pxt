import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { CriteriaResult } from "../types/criteria";

export function updateEvalResults(criteriaInstanceId: string, result: CriteriaResult, ) {
    const { state, dispatch } = stateAndDispatch();
    dispatch(Actions.setEvalResult(criteriaInstanceId, result));
    console.log("we updating the eval results bitchez");
    console.log(state.evalResults)
}