import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { logError } from "../services/loggingService";
import { CatalogCriteria } from "../types/criteria";
import { ErrorCode } from "../types/errorCode";

const prodFiles = [
    "/teachertool/catalog.json", // target-specific catalog
    "/teachertool/catalog-shared.json" // shared across all targets
];

// Catalog entries still being tested, will only appear when in debug mode (?dbg=1)
const testFiles = [
    "/teachertool/catalog-test.json",
    "/teachertool/catalog-shared-test.json"
]

interface CatalogInfo {
    criteria: CatalogCriteria[];
}

export async function loadCatalogAsync() {
    const { state: teacherTool, dispatch } = stateAndDispatch();
    const catalogFiles = teacherTool.flags.testCatalog ? prodFiles.concat(testFiles) : prodFiles;

    let fullCatalog: CatalogCriteria[] = [];
    for (const catalogFile of catalogFiles) {
        try {
            const catalogResponse = await fetch(catalogFile);
            const catalogContent = await catalogResponse.json() as CatalogInfo;
            fullCatalog = fullCatalog.concat(catalogContent.criteria ?? []);
        } catch (e) {
            logError(ErrorCode.loadCatalogFailed, e, { catalogFile });
            continue;
        }
    }

    dispatch(Actions.setCatalog(fullCatalog));
}