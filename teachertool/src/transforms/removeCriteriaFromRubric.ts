import { stateAndDispatch } from "../state";
import { logDebug } from "../services/loggingService";
import { CriteriaInstance } from "../types/criteria";
import { setRubric } from "./setRubric";

export function removeCriteriaFromRubric(instance: CriteriaInstance) {
    const { state: teacherTool, dispatch } = stateAndDispatch();

    logDebug(`Removing criteria with id: ${instance.instanceId}`);

    const newRubric = {
        ...teacherTool.rubric,
        criteria: teacherTool.rubric.criteria.filter(c => c.instanceId !== instance.instanceId),
    };

    setRubric(newRubric);

    pxt.tickEvent("teachertool.removecriteria", { catalogCriteriaId: instance.catalogCriteriaId });
}
