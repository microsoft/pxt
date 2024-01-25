import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { logDebug } from "../services/loggingService";
import { CriteriaInstance } from "../types/criteria";

export function removeCriteriaFromRubric(instance: CriteriaInstance) {
    logDebug(`Removing criteria with id: ${instance.instanceId}`);

    const { dispatch } = stateAndDispatch();
    dispatch(Actions.removeCriteriaInstance(instance.instanceId));
    pxt.tickEvent("teachertool.removecriteria", { catalogCriteriaId: instance.catalogCriteriaId });
}