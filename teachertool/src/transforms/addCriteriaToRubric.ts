import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { logDebug, logError } from "../services/loggingService";
import { getCatalogCriteriaWithId } from "../utils";
import { CriteriaInstance, CriteriaParameterValue } from "../types/criteria";
import { nanoid } from "nanoid";

export function addCriteriaToRubric(catalogCriteriaIds: string[]) {
    const { state: teacherTool, dispatch } = stateAndDispatch();

    // Create instances for each of the catalog criteria.
    const newSelectedCriteria = [...teacherTool.selectedCriteria ?? []]
    for(const catalogCriteriaId of catalogCriteriaIds) {
        const catalogCriteria = getCatalogCriteriaWithId(catalogCriteriaId);
        if (!catalogCriteria) {
            logError("adding_missing_criteria", "Attempting to add criteria with unrecognized id", { id: catalogCriteriaId });
            continue;
        }

        const params = catalogCriteria.parameters?.map(
            param =>
                ({
                    name: param.name,
                    value: undefined,
                } as CriteriaParameterValue)
        );

        const instanceId = nanoid();

        logDebug(`Adding criteria with Catalog ID '${catalogCriteriaId}' and Instance ID '${instanceId}'`);
        const criteriaInstance = {
            catalogCriteriaId,
            instanceId,
            params
        } as CriteriaInstance;

        newSelectedCriteria.push(criteriaInstance);
    }

    dispatch(Actions.setSelectedCriteria(newSelectedCriteria));

    pxt.tickEvent("teachertool.addcriteria", { ids: JSON.stringify(catalogCriteriaIds) });
}