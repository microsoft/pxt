import { stateAndDispatch } from "../state";
import { logDebug } from "../services/loggingService";
import { setChecklist } from "./setChecklist";
import { Ticks } from "../constants";
import { getCriteriaInstanceWithId } from "../state/helpers";

export function readdCriteriaToChecklist(criteriaInstanceId: string) {
    const { state: teacherTool } = stateAndDispatch();

    logDebug(`Re-adding criteria with id: ${criteriaInstanceId}`);

    const instance = getCriteriaInstanceWithId(teacherTool, criteriaInstanceId);
    const catalogCriteriaId = instance?.catalogCriteriaId;
    const allCriteria = [...teacherTool.checklist.criteria];
    const criteriaIndex = allCriteria.findIndex(c => c.instanceId === criteriaInstanceId);
    allCriteria[criteriaIndex].deleted = false;

    const newChecklist = {
        ...teacherTool.checklist,
        criteria: allCriteria,
    };

    setChecklist(newChecklist);

    if (catalogCriteriaId) {
        pxt.tickEvent(Ticks.RemoveCriteria, { catalogCriteriaId });
    }
}
