import { stateAndDispatch } from "../state";
import { v4 as uuidV4 } from 'uuid';
import * as Actions from "../state/actions";
import { logDebug } from "../services/loggingService";

export async function addCriteriaToRubric(catalogCriteria: pxt.blocks.CatalogCriteria) {
    logDebug(`Adding criteria with id: ${catalogCriteria.id}`);

    const { dispatch } = stateAndDispatch();
    const instanceId = uuidV4();
    const params = catalogCriteria.parameters?.map(
        param =>
            ({
                name: param.name,
                value: undefined,
            } as pxt.blocks.CriteriaParameterValue)
    );

    const criteriaInstance = {
        catalogCriteriaId: catalogCriteria.id,
        instanceId,
        params
    } as pxt.blocks.CriteriaInstance;

    dispatch(Actions.addCriteriaInstance(criteriaInstance));

    pxt.tickEvent("teachertool.addcriteria", { id: catalogCriteria.id });
}