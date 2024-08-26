import { stateAndDispatch } from "../state";
import { makeToast } from "../utils";
import { showToast } from "./showToast";
import { setActiveTab } from "./setActiveTab";
import { runSingleEvaluateAsync } from "./runSingleEvaluateAsync";

export async function runEvaluateAsync(fromUserInteraction: boolean) {
    const { state: teacherTool } = stateAndDispatch();
    const { projectMetadata } = teacherTool;

    if (!projectMetadata) {
        return;
    }

    if (fromUserInteraction) {
        setActiveTab("results");
    }

    // EvalRequest promises will resolve to true if evaluation completed successfully (regarless of pass/fail).
    // They will only resolve to false if evaluation was unable to complete.
    const evalRequests = teacherTool.checklist.criteria.map(criteriaInstance =>
        runSingleEvaluateAsync(criteriaInstance.instanceId, false)
    );

    if (evalRequests.length === 0) {
        return;
    }

    const results = await Promise.all(evalRequests);
    if (fromUserInteraction) {
        const errorCount = results.filter(r => !r).length;
        if (errorCount === teacherTool.checklist.criteria.length) {
            showToast(makeToast("error", lf("Unable to run evaluation")));
        } else if (errorCount > 0) {
            showToast(makeToast("error", lf("Unable to evaluate some criteria")));
        } else {
            showToast(makeToast("success", lf("Evaluation complete")));
        }
    }
}
