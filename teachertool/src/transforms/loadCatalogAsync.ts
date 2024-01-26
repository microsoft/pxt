import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { CatalogCriteria } from "../types/criteria";
import { loadTestableCollectionFromFileAsync } from "../utils/fileSystemHelpers";

const prodFiles = [
    "/teachertool/catalog.json", // target-specific catalog
    "/teachertool/catalog-shared.json" // shared across all targets
];

export async function loadCatalogAsync() {
    const { dispatch } = stateAndDispatch();
    const fullCatalog = await loadTestableCollectionFromFileAsync<CatalogCriteria>(prodFiles, "criteria");
    dispatch(Actions.setCatalog(fullCatalog));
}