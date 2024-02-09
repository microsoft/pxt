import { stateAndDispatch } from "../state";
import { getCatalogCriteriaWithId } from "../state/helpers";
import { logDebug, logError } from "../services/loggingService";
import { CriteriaInstance, CriteriaParameterValue } from "../types/criteria";
import { nanoid } from "nanoid";
import { ErrorCode } from "../types/errorCode";
import { setRubric } from "./setRubric";

export function addCriteriaToRubric(catalogCriteriaIds: string[]) {
    const { state: teacherTool, dispatch } = stateAndDispatch();

    // Create instances for each of the catalog criteria.
    const newRubric = {
        ...teacherTool.rubric,
        criteria: [...(teacherTool.rubric.criteria ?? [])],
    };

    for (const catalogCriteriaId of catalogCriteriaIds) {
        const catalogCriteria = getCatalogCriteriaWithId(catalogCriteriaId);
        if (!catalogCriteria) {
            logError(ErrorCode.addingMissingCriteria, "Attempting to add criteria with unrecognized id", {
                id: catalogCriteriaId,
            });
            continue;
        }

        const params = catalogCriteria.params?.map(
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
            params,
        } as CriteriaInstance;

        newRubric.criteria.push(criteriaInstance);
    }

    setRubric(newRubric);

    pxt.tickEvent("teachertool.addcriteria", {
        ids: JSON.stringify(catalogCriteriaIds),
    });
}
