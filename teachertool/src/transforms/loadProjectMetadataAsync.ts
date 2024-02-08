import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { getProjectMetaAsync } from "../services/backendRequests";
import { logDebug } from "../services/loggingService";
import { showToast } from "./showToast";
import { makeNotification } from "../utils";

export async function loadProjectMetadataAsync(shareLink: string) {
    const { dispatch } = stateAndDispatch();

    const scriptId = pxt.Cloud.parseScriptId(shareLink);
    if (!scriptId) {
        showToast(makeNotification("error", lf("Invalid share link")));
        dispatch(Actions.setProjectMetadata(undefined));
        return;
    }

    const projMeta = await getProjectMetaAsync(scriptId);
    if (!projMeta) {
        showToast(makeNotification("error", lf("Failed to load project")));
        dispatch(Actions.setProjectMetadata(undefined));
        return;
    }

    dispatch(Actions.clearAllEvalResults());
    dispatch(Actions.setProjectMetadata(projMeta));
    logDebug(`Loaded project metadata: ${JSON.stringify(projMeta)}`);
}
