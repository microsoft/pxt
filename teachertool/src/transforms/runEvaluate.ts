import { getProjectMetaAsync, getProjectTextAsync } from "../services/BackendRequests";

export async function runEvaluate(shareLink: string, rubric: string) {
    console.log(`Evaluate ${shareLink} with ${rubric}!`);
    const scriptId = pxt.Cloud.parseScriptId(shareLink);
    if (!scriptId) {
        console.log("Invalid share link!");
        return;
    }
    const projText = await getProjectTextAsync(scriptId);
    if (projText) console.log(projText["main.blocks"] || "Failed to get blocks xml!");

    const projMeta = await getProjectMetaAsync(scriptId);
    if (projMeta) console.log(projMeta);

    console.log(pxt.blocks.parseRubric(rubric));
}