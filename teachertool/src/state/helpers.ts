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

export function getCriteriaInstanceWithId(state: AppState, id: string): CriteriaInstance | undefined {
    return state.rubric.criteria.find(c => c.instanceId === id);
}

export function verifyCriteriaInstanceIntegrity(instance: CriteriaInstance) {
    const catalogCriteria = getCatalogCriteriaWithId(instance.catalogCriteriaId);

    if (!catalogCriteria) {
        throw new Error("Unrecognized catalog id in criteria instance.");
    }

    for (const param of instance.params ?? []) {
        if (!catalogCriteria?.params?.find(p => p.name === param.name)) {
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

export function getSelectableCatalogCriteria(state: AppState): CatalogCriteria[] {
    const usedCatalogCriteria = state.rubric.criteria.map(c => c.catalogCriteriaId) ?? [];

    // Return a criteria as selectable if it has parameters (so it can be used multiple times in a rubric)
    // or if it has not yet been used in the active rubric.
    return (
        state.catalog?.filter(
            catalogCriteria =>
                (catalogCriteria.params && catalogCriteria.params.length > 0) ||
                !usedCatalogCriteria.includes(catalogCriteria.id)
        ) ?? []
    );
}
