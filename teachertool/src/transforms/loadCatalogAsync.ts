import { loadTestableCollectionFromDocsAsync } from "../services/backendRequests";
import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { CatalogCriteria } from "../types/criteria";

const prodFiles = [
    "/teachertool/catalog-shared.json", // shared across all targets
    "/teachertool/catalog.json", // target-specific catalog
];

export async function loadCatalogAsync() {
    const { dispatch } = stateAndDispatch();
    const fullCatalog = await loadTestableCollectionFromDocsAsync<CatalogCriteria>(prodFiles, "criteria");

    fullCatalog.forEach(c => {
        // Convert parameter names to lower-case for case-insensitive matching
        c.params?.forEach(p => {
            p.name = p.name.toLocaleLowerCase();
        });

        // Add default tag if none are present
        if (!c.tags || c.tags.length === 0) {
            c.tags = ["Other"];
        }
    });

    dispatch(Actions.setCatalog(fullCatalog));
}
