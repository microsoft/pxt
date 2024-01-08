export const getProjectTextAsync = async (
    projectId: string
): Promise<pxt.Cloud.JsonText | undefined> => {
    try {
        const projectTextUrl = `${pxt.Cloud.apiRoot}/${projectId}/text`;
        const response = await fetch(projectTextUrl);
        if (!response.ok) {
            throw new Error("Unable to fetch the project details");
        } else {
            const projectText = await response.json();
            return projectText;
        }
    } catch (error) {
        console.error(error);
    }
};

export const getProjectMetaAsync = async (
    projectId: string
): Promise<pxt.Cloud.JsonScript | undefined> => {
    try {
        const projectMetaUrl = `${pxt.Cloud.apiRoot}/${projectId}`;
        const response = await fetch(projectMetaUrl);
        if (!response.ok) {
            throw new Error("Unable to fetch the project meta information");
        } else {
            const projectMeta = await response.json();
            return projectMeta;
        }
    } catch (error) {
        console.error(error);
    }
};