import { getProjectMetaAsync, getProjectTextAsync } from "../services/BackendRequests";
import { logError } from "../services/loggingService";
import { runEvalInEditorAsync } from "../services/makecodeEditorService";
import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";

export async function runEvaluateAsync(shareLink: string, rubric: string) {
    const { dispatch } = stateAndDispatch();
    const scriptId = pxt.Cloud.parseScriptId(shareLink);
    if (!scriptId) {
        logError("invalid_share_link", `Failed to parse share link: '${shareLink}'!`)
        return;
    }

    // TODO : Loading screen type thing
    const evalResult = await runEvalInEditorAsync(rubric);
    // TODO clear loading

    if (evalResult) {
        dispatch(Actions.setEvalResult(evalResult));
    }
}