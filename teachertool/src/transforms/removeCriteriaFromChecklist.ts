import { stateAndDispatch } from "../state";
import { logDebug } from "../services/loggingService";
import { CriteriaInstance } from "../types/criteria";
import { setChecklist } from "./setChecklist";
import { Ticks } from "../constants";

export function removeCriteriaFromChecklist(instance: CriteriaInstance) {
    const { state: teacherTool, dispatch } = stateAndDispatch();

    logDebug(`Removing criteria with id: ${instance.instanceId}`);

    const newChecklist = {
        ...teacherTool.checklist,
        criteria: teacherTool.checklist.criteria.filter(c => c.instanceId !== instance.instanceId),
    };

    setChecklist(newChecklist);

    pxt.tickEvent(Ticks.RemoveCriteria, { catalogCriteriaId: instance.catalogCriteriaId });
}
