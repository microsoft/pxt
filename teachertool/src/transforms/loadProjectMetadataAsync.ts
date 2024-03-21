import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { getProjectMetaAsync } from "../services/backendRequests";
import { logDebug } from "../services/loggingService";
import { showToast } from "./showToast";
import { makeToast } from "../utils";
import { initNewProjectResults } from "./initNewProjectResults";
import { loadToolboxCategoriesAsync } from "./loadToolboxCategoriesAsync";

export async function loadProjectMetadataAsync(inputText: string, shareLink: string) {
    const { dispatch } = stateAndDispatch();

    const scriptId = pxt.Cloud.parseScriptId(shareLink);
    if (!scriptId) {
        showToast(makeToast("error", lf("Invalid share link")));
        dispatch(Actions.setProjectMetadata(undefined));
        return;
    }

    const projMeta = await getProjectMetaAsync(scriptId);
    if (!projMeta) {
        showToast(makeToast("error", lf("Failed to load project")));
        dispatch(Actions.setProjectMetadata(undefined));
        return;
    }

    if (projMeta.target !== pxt.appTarget.id) {
        showToast(makeToast("error", lf("That project was built with a different MakeCode editor")));
        dispatch(Actions.setProjectMetadata(undefined));
        return;
    }
    const projectData = {
        ...projMeta,
        inputText,
    };
    dispatch(Actions.setProjectMetadata(projectData));
    initNewProjectResults();
    logDebug(`Loaded project metadata: ${JSON.stringify(projMeta)}`);

    // TODO thsparks : We need to loadToolboxCategoriesAsync once the iframe has loaded, so it doesn't work to leave it here.
    // TODO thsparks : Reload all blocks.
}
