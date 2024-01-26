import { logError } from "../services/loggingService";
import { stateAndDispatch } from "../state";
import { ErrorCode } from "../types/errorCode";

// convert teachertool/somefile.json to teachertool/test/somefile.json
function getTestFileName(fileName: string) {
    const parts = fileName.split("/");
    parts.splice(parts.length - 1, 0, "test");
    return parts.join("/");
}

// This allows us to take multiple lists stored in json docs files and concatenate them into
// a single unified list. It also automatically adds entries from test files if the test catalog flag is set.
export async function loadTestableCollectionFromFileAsync<T>(fileNames: string[], rootName: string): Promise<T[]> {
    const { state: teacherTool } = stateAndDispatch();

    const files = teacherTool.flags.testCatalog ? fileNames.concat(fileNames.map(getTestFileName)) : fileNames;
    let allResults: T[] = [];
    for (const planFile of files) {
        try {
            const response = await fetch(planFile);
            const content = await response.json();
            allResults = allResults.concat(content[rootName] ?? []);
        } catch (e) {
            logError(ErrorCode.loadCollectionFileFailed, e, { collection: rootName, file: planFile });
            continue;
        }
    }

    return allResults;
}