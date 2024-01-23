import { stateAndDispatch } from "../state";
import { v4 as uuidV4 } from 'uuid';
import * as Actions from "../state/actions";
import { logDebug, logError } from "../services/loggingService";

export async function addCriteriaToRubric(catalogCriteriaIds: string[]) {
    const { state: teacherTool, dispatch } = stateAndDispatch();

    // Create instances for each of the catalog criteria.
    const instances = catalogCriteriaIds.reduce((accumulator, catalogCriteriaId) => {
        logDebug(`Adding criteria with ID ${catalogCriteriaId}`);
        const catalogCriteria = teacherTool.catalog?.find(cat => cat.id === catalogCriteriaId);
        if (!catalogCriteria) {
            logError("adding_missing_criteria", "Attempting to add criteria with unrecognized id", { id: catalogCriteriaId });
            return accumulator;
        }

        const params = catalogCriteria.parameters?.map(
            param =>
                ({
                    name: param.name,
                    value: undefined,
                } as pxt.blocks.CriteriaParameterValue)
        );

        const instanceId = uuidV4();
        const criteriaInstance = {
            catalogCriteriaId,
            instanceId,
            params
        } as pxt.blocks.CriteriaInstance;

        return [...accumulator, criteriaInstance];
    }, [] as pxt.blocks.CriteriaInstance[]);

    dispatch(Actions.addCriteriaInstances(instances));

    pxt.tickEvent("teachertool.addcriteria", { ids: JSON.stringify(catalogCriteriaIds) });
}