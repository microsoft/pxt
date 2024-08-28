import { Strings } from "../constants";
import { stateAndDispatch } from "../state";
import { ErrorCode } from "../types/errorCode";
import { logError } from "./loggingService";

export async function fetchJsonDocAsync<T = any>(url: string): Promise<T | undefined> {
    try {
        const response = await fetch(url, {
            cache: "no-cache",
        });
        if (!response.ok) {
            throw new Error("Unable to fetch the json file");
        } else {
            const json = await response.json();
            return json;
        }
    } catch (e) {
        logError(ErrorCode.fetchJsonDocAsync, e);
    }
}

export async function getProjectTextAsync(projectId: string): Promise<pxt.Cloud.JsonText | undefined> {
    try {
        const projectTextUrl = `${pxt.Cloud.apiRoot}/${projectId}/text`;
        const response = await fetch(projectTextUrl);
        if (!response.ok) {
            throw new Error("Unable to fetch the project details");
        } else {
            const projectText = await response.json();
            return projectText;
        }
    } catch (e) {
        logError(ErrorCode.getProjectTextAsync, e);
    }
}

export async function getProjectMetaAsync(projectId: string): Promise<pxt.Cloud.JsonScript | undefined> {
    try {
        const projectMetaUrl = `${pxt.Cloud.apiRoot}/${projectId}`;
        const response = await fetch(projectMetaUrl);
        if (!response.ok) {
            throw new Error("Unable to fetch the project meta information");
        } else {
            const projectMeta = await response.json();
            return projectMeta;
        }
    } catch (e) {
        logError(ErrorCode.getProjectMetaAsync, e);
    }
}

export async function downloadTargetConfigAsync(): Promise<pxt.TargetConfig | undefined> {
    try {
        return await pxt.targetConfigAsync();
    } catch (e) {
        logError(ErrorCode.downloadTargetConfigAsync, e);
    }
}

// convert teachertool/somefile.json to teachertool/test/somefile.json
function getTestFilePath(fileName: string) {
    const parts = fileName.split("/");
    parts.splice(parts.length - 1, 0, "test");
    return parts.join("/");
}

// This allows us to take multiple lists stored in json docs files and concatenate them into
// a single unified list. It also automatically adds entries from test files if the test catalog flag is set.
export async function loadTestableCollectionFromDocsAsync<T>(fileNames: string[], rootName: string): Promise<T[]> {
    const { state: teacherTool } = stateAndDispatch();

    const files = teacherTool.flags.testCatalog ? fileNames.map(getTestFilePath).concat(fileNames) : fileNames;
    let allResults: T[] = [];
    for (const planFile of files) {
        try {
            const response = await fetch(planFile, {
                cache: "no-cache",
            });

            if (response.ok) {
                const content = await response.json();
                allResults = allResults.concat(content[rootName] ?? []);
            }
        } catch (e) {
            logError(ErrorCode.loadCollectionFileFailed, e, { collection: rootName, file: planFile });
            continue;
        }
    }

    return allResults;
}

export async function askCopilotQuestionAsync(shareId: string, question: string): Promise<string | undefined> {
    const url = `/api/copilot/question`;
    const data = { id: shareId, question };
    let result: string = "";
    try {
        const request = await pxt.auth.AuthClient.staticApiAsync(url, data, "POST");
        if (request.statusCode != 200) {
            throw new Error(request.err || lf("Unable to reach AI. Error code: {0}", request.statusCode));
        }
        result = await request.resp.json();
    } catch (e) {
        logError(ErrorCode.askAIQuestion, e);
        throw e; // We will catch this upstream so we can show the error
    }

    return result;
}
