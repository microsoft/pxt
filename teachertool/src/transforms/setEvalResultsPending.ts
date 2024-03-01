import { stateAndDispatch } from "../state";
import { CriteriaEvaluationResult, CriteriaResult } from "../types/criteria";
import { Rubric } from "../types/rubric";
import * as Actions from "../state/actions";


export function setEvalResultsPending({ clearAllEntries, rubric }: {
    clearAllEntries?: boolean,
    rubric?: Rubric
}): void {
    const { state: teachertool, dispatch } = stateAndDispatch();
    let allEvalResults: pxt.Map<CriteriaResult> = {};
    const usedRubric = rubric || teachertool.rubric;
    for (const criteria of usedRubric.criteria) {
        const instanceId = criteria.instanceId;
        if (!teachertool.evalResults[instanceId] || clearAllEntries) {
            allEvalResults[instanceId] = { result: CriteriaEvaluationResult.Pending };
        }
    }
    allEvalResults = { ...teachertool.evalResults, ...allEvalResults };
    dispatch(Actions.setEvalResultsBatch(allEvalResults));
}