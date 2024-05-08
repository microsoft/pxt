import { stateAndDispatch } from "../state";
import { EvaluationStatus, CriteriaResult } from "../types/criteria";
import { Checklist } from "../types/checklist";
import * as Actions from "../state/actions";

export function setEvalResultsToNotStarted({
    overwriteExistingEntries,
    checklist,
}: {
    overwriteExistingEntries?: boolean;
    checklist?: Checklist;
}): void {
    const { state: teachertool, dispatch } = stateAndDispatch();
    let allEvalResults: pxt.Map<CriteriaResult> = {};
    const usedChecklist = checklist || teachertool.checklist;
    for (const criteria of usedChecklist.criteria) {
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
