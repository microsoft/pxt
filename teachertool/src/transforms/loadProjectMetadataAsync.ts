import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { getProjectMetaAsync } from "../services/backendRequests";
import { logDebug } from "../services/loggingService";
import { postNotification } from "./postNotification";
import { makeNotification } from "../utils";

export async function loadProjectMetadataAsync(shareLink: string) {
    const { dispatch } = stateAndDispatch();

    const scriptId = pxt.Cloud.parseScriptId(shareLink);
    if (!scriptId) {
        postNotification(makeNotification(lf("Invalid share link"), 2000));
        dispatch(Actions.setProjectMetadata(undefined));
        return;
    }

    const projMeta = await getProjectMetaAsync(scriptId);
    if (!projMeta) {
        postNotification(makeNotification(lf("Failed to load project"), 2000));
        dispatch(Actions.setProjectMetadata(undefined));
        return;
    }

    dispatch(Actions.setProjectMetadata(projMeta));
    logDebug(`Loaded project metadata: ${JSON.stringify(projMeta)}`);
}
