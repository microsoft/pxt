import { stateAndDispatch } from "../state";
import { v4 as uuidV4 } from 'uuid';
import * as Actions from "../state/actions";
import { logDebug } from "../services/loggingService";

export async function removeCriteriaFromRubric(instance: pxt.blocks.CriteriaInstance) {
    logDebug(`Removing criteria with id: ${instance.instanceId}`);

    const { dispatch } = stateAndDispatch();
    dispatch(Actions.removeCriteriaInstance(instance.instanceId));
    pxt.tickEvent("teachertool.removecriteria", { catalogCriteriaId: instance.catalogCriteriaId });
}