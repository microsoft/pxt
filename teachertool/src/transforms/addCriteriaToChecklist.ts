import { stateAndDispatch } from "../state";
import { getCatalogCriteriaWithId } from "../state/helpers";
import { logDebug, logError } from "../services/loggingService";
import { CriteriaInstance, CriteriaParameterValue } from "../types/criteria";
import { nanoid } from "nanoid";
import { ErrorCode } from "../types/errorCode";
import { setChecklist } from "./setChecklist";
import { Ticks } from "../constants";

export function addCriteriaToChecklist(catalogCriteriaIds: string[]) {
    const { state: teacherTool, dispatch } = stateAndDispatch();

    // Create instances for each of the catalog criteria.
    const newChecklist = {
        ...teacherTool.checklist,
        criteria: [...(teacherTool.checklist.criteria ?? [])],
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
                    value: param.default,
                } as CriteriaParameterValue)
        );

        const instanceId = nanoid();

        logDebug(`Adding criteria with Catalog ID '${catalogCriteriaId}' and Instance ID '${instanceId}'`);
        const criteriaInstance = {
            catalogCriteriaId,
            instanceId,
            params,
        } as CriteriaInstance;

        newChecklist.criteria.push(criteriaInstance);
    }

    setChecklist(newChecklist);

    pxt.tickEvent(Ticks.AddCriteria, {
        ids: JSON.stringify(catalogCriteriaIds),
    });
}
