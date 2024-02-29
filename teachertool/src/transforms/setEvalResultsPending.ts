import { stateAndDispatch } from "../state";
import { CriteriaEvaluationResult, CriteriaResult } from "../types/criteria";
import * as Actions from "../state/actions";


export function setEvalResultsPending() {
    const { state: teachertool, dispatch } = stateAndDispatch();
    let allEvalResults: pxt.Map<CriteriaResult> = {};
    for (const criteria of teachertool.rubric.criteria) {
        const instanceId = criteria.instanceId;
        if (!teachertool.evalResults[instanceId]) {
            allEvalResults[instanceId] = { result: CriteriaEvaluationResult.Pending };
        }
    }
    allEvalResults = { ...teachertool.evalResults, ...allEvalResults };
    dispatch(Actions.setEvalResultsBatch(allEvalResults));
}