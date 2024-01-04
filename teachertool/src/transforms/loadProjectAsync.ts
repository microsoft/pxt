import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { postNotification } from "./postNotification";
import { makeNotification } from "../utils";
import { sendMessageAsync } from "../services/makecodeEditorService";

export function loadProjectAsync(projectId: string, bool: boolean) {
    const { dispatch } = stateAndDispatch();
    sendMessageAsync({
        type: "pxteditor",
        action: "sethighcontrast",
        on: bool
        }  as pxt.editor.EditorMessageSetHighContrastRequest);
    postNotification(makeNotification(`project ${projectId} evaluated`, 2000));

}
