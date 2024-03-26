import { ErrorCode } from "./constants";
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
