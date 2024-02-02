import { CatalogCriteria, CriteriaInstance } from "../types/criteria";
import { Rubric } from "../types/rubric";
import { stateAndDispatch } from "./appStateContext";

export function getCatalogCriteriaWithId(id: string): CatalogCriteria | undefined {
    const { state } = stateAndDispatch();
    return state.catalog?.find(c => c.id === id);
}

export function validateCriteriaInstance(instance: CriteriaInstance) {
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
