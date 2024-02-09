import { logDebug, logError } from "../services/loggingService";
import { stateAndDispatch } from "../state";
import { getCriteriaInstanceWithId } from "../state/helpers";
import { ErrorCode } from "../types/errorCode";
import { setRubric } from "./setRubric";

export function setParameterValue(instanceId: string, paramName: string, newValue: any) {
    const { state: teacherTool } = stateAndDispatch();
    logDebug(`Setting parameter value for '${paramName}' to '${newValue}' for criteria instance '${instanceId}'`);

    const criteriaInstance = getCriteriaInstanceWithId(teacherTool, instanceId);
    if (!criteriaInstance) {
        logError(ErrorCode.missingCriteriaInstance, `Unable to find criteria instance with id '${instanceId}'`);
        return;
    }

    const newInstanceSet = teacherTool.rubric.criteria.map(c => {
        if (c.instanceId === instanceId) {
            const newParams = c.params?.map(p => {
                if (p.name === paramName) {
                    return { ...p, value: newValue };
                }
                return p;
            });
            return { ...c, params: newParams };
        }
        return c;
    });

    const newRubric = { ...teacherTool.rubric, criteria: newInstanceSet };

    setRubric(newRubric);
}
