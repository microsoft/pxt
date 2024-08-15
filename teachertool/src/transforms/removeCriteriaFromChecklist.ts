import { stateAndDispatch } from "../state";
import { logDebug } from "../services/loggingService";
import { setChecklist } from "./setChecklist";
import { Ticks } from "../constants";
import { getCriteriaInstanceWithId } from "../state/helpers";

export function removeCriteriaFromChecklist(criteriaInstanceId: string) {
    const { state: teacherTool } = stateAndDispatch();

    logDebug(`Removing criteria with id: ${criteriaInstanceId}`);

    const instance = getCriteriaInstanceWithId(teacherTool, criteriaInstanceId);
    const catalogCriteriaId = instance?.catalogCriteriaId;

    const newChecklist = {
        ...teacherTool.checklist,
        criteria: teacherTool.checklist.criteria.filter(c => c.instanceId !== criteriaInstanceId),
    };

    setChecklist(newChecklist);

    if (catalogCriteriaId) {
        pxt.tickEvent(Ticks.RemoveCriteria, { catalogCriteriaId });
    }
}
