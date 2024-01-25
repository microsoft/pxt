import { logError } from "./loggingService";

export async function getProjectTextAsync(
    projectId: string
): Promise<pxt.Cloud.JsonText | undefined> {
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
        logError("getProjectTextAsync", e);
    }
}

export async function getProjectMetaAsync(
    projectId: string
): Promise<pxt.Cloud.JsonScript | undefined> {
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
        logError("getProjectMetaAsync", e);
    }
}

export async function downloadTargetConfigAsync(): Promise<
    pxt.TargetConfig | undefined
> {
    try {
        return await pxt.targetConfigAsync();
    } catch (e) {
        logError("downloadTargetConfigAsync", e);
    }
}
