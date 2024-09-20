import { stateAndDispatch } from "../state";
import { getChecklistHash, getObfuscatedProjectId, makeToast } from "../utils";
import { showToast } from "./showToast";
import { setActiveTab } from "./setActiveTab";
import { runSingleEvaluateAsync } from "./runSingleEvaluateAsync";
import { Strings, Ticks } from "../constants";

export async function runEvaluateAsync(fromUserInteraction: boolean) {
    const { state: teacherTool } = stateAndDispatch();
    const { projectMetadata } = teacherTool;

    if (!projectMetadata) {
        return;
    }

    if (fromUserInteraction) {
        setActiveTab("results");
    }

    const evalRequests = teacherTool.checklist.criteria.map(criteriaInstance =>
        runSingleEvaluateAsync(criteriaInstance.instanceId, fromUserInteraction)
    );

    if (evalRequests.length === 0) {
        return;
    }

    pxt.tickEvent(Ticks.BulkEvaluate, {
        fromUserInteraction: fromUserInteraction + "",
        criteriaCount: evalRequests.length,
        catalogCriteriaIds: JSON.stringify(teacherTool.checklist.criteria.map(c => c.catalogCriteriaId)),
        checklistHash: getChecklistHash(teacherTool.checklist),
        projectId: getObfuscatedProjectId(teacherTool.projectMetadata?.id),
    });

    // EvalRequest promises will resolve to true if evaluation completed successfully (regarless of pass/fail).
    // They will only resolve to false if evaluation was unable to complete.
    const results = await Promise.all(evalRequests);
    if (fromUserInteraction) {
        const errorCount = results.filter(r => !r).length;
        if (errorCount === teacherTool.checklist.criteria.length) {
            showToast(makeToast("error", Strings.UnableToEvaluate));
        } else if (errorCount > 0) {
            showToast(makeToast("error", Strings.UnableToEvaluatePartial));
        } else {
            showToast(makeToast("success", Strings.EvaluationComplete));
        }
    }
}
