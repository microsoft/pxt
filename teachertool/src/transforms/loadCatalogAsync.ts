import { Strings } from "../constants";
import { loadTestableCollectionFromDocsAsync } from "../services/backendRequests";
import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { CatalogCriteria } from "../types/criteria";

const prodFiles = [
    "/teachertool/catalog-shared.json", // shared across all targets
    "/teachertool/catalog.json", // target-specific catalog
];

function dedupeCriteriaById(criteria: CatalogCriteria[]): CatalogCriteria[] {
    const deduped: CatalogCriteria[] = [];
    const idToIndex = new Map<string, number>();

    for (const entry of criteria) {
        const id = entry.id?.toLocaleLowerCase();

        if (id) {
            const existingIndex = idToIndex.get(id);
            if (existingIndex !== undefined) {
                deduped[existingIndex] = entry;
                continue;
            }
            idToIndex.set(id, deduped.length);
        }

        deduped.push(entry);
    }

    return deduped;
}
export async function loadCatalogAsync() {
    const { dispatch } = stateAndDispatch();
    const fullCatalog = await loadTestableCollectionFromDocsAsync<CatalogCriteria>(prodFiles, "criteria");
    const uniqueCatalog = dedupeCriteriaById(fullCatalog);

    uniqueCatalog.forEach(c => {
        // Convert parameter names to lower-case for case-insensitive matching
        c.params?.forEach(p => {
            p.name = p.name.toLocaleLowerCase();
        });

        // Add default tag if none are present
        if (!c.tags || c.tags.length === 0) {
            c.tags = [Strings.Other];
        }
    });

    dispatch(Actions.setCatalog(uniqueCatalog));
}
