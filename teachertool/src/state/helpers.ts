import { logError } from "../services/loggingService";
import { CatalogCriteria, CriteriaInstance } from "../types/criteria";
import { ErrorCode } from "../types/errorCode";
import { Rubric } from "../types/rubric";
import { stateAndDispatch } from "./appStateContext";
import { AppState } from "./state";

export function getCatalogCriteriaWithId(id: string): CatalogCriteria | undefined {
    const { state } = stateAndDispatch();
    return state.catalog?.find(c => c.id === id);
}

export function verifyCriteriaInstanceIntegrity(instance: CriteriaInstance) {
    const catalogCriteria = getCatalogCriteriaWithId(instance.catalogCriteriaId);

    if (!catalogCriteria) {
        throw new Error("Unrecognized catalog id in criteria instance.");
    }

    for (const param of instance.params ?? []) {
        if (!catalogCriteria?.parameters?.find(p => p.name === param.name)) {
            throw new Error("Unrecognized parameter in criteria instance.");
        }
    }
}

export function verifyRubricIntegrity(rubric: Rubric): {
    valid: boolean;
    validCriteria: CriteriaInstance[];
    invalidCriteria: CriteriaInstance[];
} {
    const validCriteria: CriteriaInstance[] = [];
    const invalidCriteria: CriteriaInstance[] = [];
    for (const criteria of rubric.criteria) {
        try {
            verifyCriteriaInstanceIntegrity(criteria);
            validCriteria.push(criteria);
        } catch (error) {
            logError(ErrorCode.unableToLoadCriteriaInstance, error);
            invalidCriteria.push(criteria);
        }
    }
    return { valid: invalidCriteria.length === 0, validCriteria, invalidCriteria };
}

export function isProjectLoaded(state: AppState) {
    return !!state.projectMetadata;
}
