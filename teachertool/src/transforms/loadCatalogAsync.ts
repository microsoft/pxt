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

    for (const criteria of fullCatalog) {
        for (let i = 0; i < (criteria.params?.length ?? 0); i++) {
            // Re-instantiate parameter into its more specific type.
            // If we don't do this, parameters will all have the base CriteriaParameter
            // validate function instead of their more specific overloads.
            const newParam = createSpecificParameter(criteria.params![i], criteria.id);

            // Convert to lower-case for case-insensitive matching
            newParam.name = newParam.name.toLocaleLowerCase();

            criteria.params![i] = newParam;
        }

        // Add default tag if none are present
        if (!criteria.tags || criteria.tags.length === 0) {
            criteria.tags = [Strings.Other];
        }
    }

    dispatch(Actions.setCatalog(fullCatalog));
}
