import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { getLastActiveRubricAsync } from "../services/indexedDbService";
import { logDebug, logError } from "../services/loggingService";
import { CriteriaInstance } from "../types/criteria";
import { getCatalogCriteriaWithId } from "../state/helpers";
import { ErrorCode } from "../types/errorCode";
import { postNotification } from "./postNotification";
import { makeNotification } from "../utils";

function validateCriteriaInstance(instance: CriteriaInstance) {
    const catalogCriteria = getCatalogCriteriaWithId(instance.catalogCriteriaId);

    if (!catalogCriteria) {
        logError(
            ErrorCode.loadUnrecognizedCatalogId,
            "Attempting to load criteria instance with unrecognized catalog id",
            { catalogCriteriaId: instance.catalogCriteriaId }
        );
        return false;
    }

    for (const param of instance.params ?? []) {
        if (!catalogCriteria?.parameters?.find(p => p.name === param.name)) {
            logError(
                ErrorCode.loadUnrecognizedParameter,
                "Attempting to load criteria instance with unrecognized parameter",
                { catalogCriteriaId: instance.catalogCriteriaId, paramName: param.name }
            );
            return false;
        }
    }

    return true;
}

export async function tryLoadLastActiveRubricAsync() {
    const { dispatch } = stateAndDispatch();

    const lastActiveRubric = await getLastActiveRubricAsync();

    if (lastActiveRubric) {
        logDebug(`Loading last active rubric '${lastActiveRubric.name}'...`);

        const initialCriteriaCount = lastActiveRubric.criteria.length;
        lastActiveRubric.criteria = lastActiveRubric.criteria.filter(validateCriteriaInstance);

        if (lastActiveRubric.criteria.length !== initialCriteriaCount) {
            postNotification(makeNotification("Some criteria could not be loaded.", 2000));
        }

        dispatch(Actions.setRubric(lastActiveRubric));
    } else {
        logDebug(`No last active rubric to load.`);
    }
}
