import { stateAndDispatch } from "../state";
import { logDebug } from "../services/loggingService";
import { setChecklist } from "./setChecklist";
import { Ticks } from "../constants";
import { getCriteriaInstanceWithId } from "../state/helpers";

export function softDeleteCriteriaFromChecklist(criteriaInstanceId: string) {
    const { state: teacherTool } = stateAndDispatch();

    logDebug(`Soft deleting criteria with id: ${criteriaInstanceId}`);

    const instance = getCriteriaInstanceWithId(teacherTool, criteriaInstanceId);
    const catalogCriteriaId = instance?.catalogCriteriaId;
    const allCriteria = [...teacherTool.checklist.criteria];
    const criteriaIndex = allCriteria.findIndex(c => c.instanceId === criteriaInstanceId);
    allCriteria[criteriaIndex].deleted = true;


    const newChecklist = {
        ...teacherTool.checklist,
        criteria: allCriteria,
    };

    setChecklist(newChecklist);

    if (catalogCriteriaId) {
        pxt.tickEvent(Ticks.RemoveCriteria, { catalogCriteriaId });
    }
}
