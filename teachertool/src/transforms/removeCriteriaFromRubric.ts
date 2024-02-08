import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { logDebug } from "../services/loggingService";
import { CriteriaInstance } from "../types/criteria";
import * as AutorunService from "../services/autorunService";

export function removeCriteriaFromRubric(instance: CriteriaInstance) {
    const { state: teacherTool, dispatch } = stateAndDispatch();

    logDebug(`Removing criteria with id: ${instance.instanceId}`);

    const newRubric = {
        ...teacherTool.rubric,
        criteria: teacherTool.rubric.criteria.filter(c => c.instanceId !== instance.instanceId),
    };

    dispatch(Actions.setRubric(newRubric));
    AutorunService.poke();

    pxt.tickEvent("teachertool.removecriteria", { catalogCriteriaId: instance.catalogCriteriaId });
}
