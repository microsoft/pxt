import { Strings } from "../constants";
import { loadTestableCollectionFromDocsAsync } from "../services/backendRequests";
import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { CatalogCriteria } from "../types/criteria";
import { createSpecificParameter } from "../types/criteriaParameters";

const prodFiles = [
    "/teachertool/catalog-shared.json", // shared across all targets
    "/teachertool/catalog.json", // target-specific catalog
];

export async function loadCatalogAsync() {
    const { dispatch } = stateAndDispatch();
    const fullCatalog = await loadTestableCollectionFromDocsAsync<CatalogCriteria>(prodFiles, "criteria");

    // Re-instantiate catalog parameters into their more specific types
    for (const criteria of fullCatalog) {
        for (let i = 0; i < (criteria.params?.length ?? 0); i++) {
            const param = criteria.params![i];
            criteria.params![i] = createSpecificParameter(param, criteria.id);
        }
    }

    fullCatalog.forEach(c => {
        // Convert parameter names to lower-case for case-insensitive matching
        c.params?.forEach(p => {
            p.name = p.name.toLocaleLowerCase();
        });

        // Add default tag if none are present
        if (!c.tags || c.tags.length === 0) {
            c.tags = [Strings.Other];
        }
    });

    dispatch(Actions.setCatalog(fullCatalog));
}
