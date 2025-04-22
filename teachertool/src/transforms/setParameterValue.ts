import { logDebug, logError } from "../services/loggingService";
import { stateAndDispatch } from "../state";
import { getCriteriaInstanceWithId } from "../state/helpers";
import { EvaluationStatus } from "../types/criteria";
import { ErrorCode } from "../types/errorCode";
import { setEvalResultOutcome } from "./setEvalResultOutcome";
import { setChecklist } from "./setChecklist";

export function setParameterValue(instanceId: string, paramName: string, newValue: any) {
    const { state: teacherTool } = stateAndDispatch();
    logDebug(`Setting parameter '${paramName}' to '${newValue}' for criteria instance '${instanceId}'`);

    const oldCriteriaInstance = getCriteriaInstanceWithId(teacherTool, instanceId);
    if (!oldCriteriaInstance) {
        logError(ErrorCode.missingCriteriaInstance, `Unable to find criteria instance with id '${instanceId}'`);
        return;
    }

    const oldParam = oldCriteriaInstance.params?.find(p => p.name === paramName);
    if (!oldParam) {
        logError(
            ErrorCode.missingParameter,
            `Unable to find parameter with name '${paramName}' in criteria instance '${instanceId}'`
        );
        return;
    }

    const newParam = { ...oldParam, value: newValue };
    const newCriteriaInstance = {
        ...oldCriteriaInstance,
        params: oldCriteriaInstance.params?.map(p => (p.name === paramName ? newParam : p)),
    };
    const newInstanceSet = teacherTool.checklist.criteria.map(c =>
        c.instanceId === instanceId ? newCriteriaInstance : c
    );
    const newChecklist = { ...teacherTool.checklist, criteria: newInstanceSet };

    setChecklist(newChecklist);
    setEvalResultOutcome(instanceId, EvaluationStatus.NotStarted, false);
}
