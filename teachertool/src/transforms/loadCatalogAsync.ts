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

    // Convert parameter names to lower-case for case-insensitive matching
    fullCatalog.forEach(c => {
        c.params?.forEach(p => {
            p.name = p.name.toLocaleLowerCase();
        });
    });

    dispatch(Actions.setCatalog(fullCatalog));
}
