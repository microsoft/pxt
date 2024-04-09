import { stateAndDispatch } from "../state";
import { EvaluationStatus, CriteriaResult } from "../types/criteria";
import { Rubric } from "../types/rubric";
import * as Actions from "../state/actions";

export function setEvalResultsPending({
    overwriteExistingEntries,
    rubric,
}: {
    overwriteExistingEntries?: boolean;
    rubric?: Rubric;
}): void {
    const { state: teachertool, dispatch } = stateAndDispatch();
    let allEvalResults: pxt.Map<CriteriaResult> = {};
    const usedRubric = rubric || teachertool.rubric;
    for (const criteria of usedRubric.criteria) {
        const instanceId = criteria.instanceId;
        if (!teachertool.evalResults[instanceId] || overwriteExistingEntries) {
            allEvalResults[instanceId] = { result: EvaluationStatus.NotStarted };
        }
    }
    if (!overwriteExistingEntries) {
        allEvalResults = { ...teachertool.evalResults, ...allEvalResults };
    }
    dispatch(Actions.setEvalResultsBatch(allEvalResults));
}
