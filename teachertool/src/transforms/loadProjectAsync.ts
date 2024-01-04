import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { postNotification } from "./postNotification";
import { makeNotification } from "../utils";
import { sendMessageAsync } from "../services/makecodeEditorService";

export async function loadProjectAsync(projectId: string, bool: boolean) {
    const { dispatch } = stateAndDispatch();
    const results = await sendMessageAsync({
        type: "pxteditor",
        action: "sethighcontrast",
        on: bool
        }  as pxt.editor.EditorMessageSetHighContrastRequest);
    console.log(results);
    postNotification(makeNotification(`project ${projectId} evaluated`, 2000));

}
