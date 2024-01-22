import { stateAndDispatch } from "../state";
import { logError } from "../services/loggingService";
import * as Actions from "../state/actions";

const prodFiles = [
    "/teachertool/catalog.json", // target-specific catalog
    "/teachertool/catalog-shared.json" // shared across all targets
];

// Catalog entries still being tested, will only appear when in debug mode (?dbg=1)
const testFiles = ["/teachertool/catalog-test.json", "/teachertool/catalog-shared-test.json"]

interface CatalogInfo {
    criteria: pxt.blocks.CatalogCriteria[];
}

export async function loadCatalog() {
    const { dispatch } = stateAndDispatch();
    const catalogFiles = pxt.options.debug ? prodFiles.concat(testFiles) : prodFiles;

    let fullCatalog: pxt.blocks.CatalogCriteria[] = [];
    for (const catalogFile of catalogFiles) {
        let catalogContent = "";
        try {
            const catalogResponse = await fetch(catalogFile);
            catalogContent = await catalogResponse.text();
        } catch (e) {
            logError("fetch_catalog_failed", e as string, { catalogFile });
            continue;
        }

        if (!catalogContent) {
            // Empty file.
            continue;
        }

        try {
            const catalogInfoParsed = JSON.parse(catalogContent);
            const catalogInfo = catalogInfoParsed as CatalogInfo;
            fullCatalog = fullCatalog.concat(catalogInfo.criteria ?? []);
        } catch (e) {
            logError("parse_catalog_failed", e as string, {catalogFile});
            continue;
        }
    }

    dispatch(Actions.setCatalog(fullCatalog));
}