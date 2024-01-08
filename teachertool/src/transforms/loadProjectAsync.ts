import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { postNotification } from "./postNotification";
import { makeNotification } from "../utils";
import { setHighContrastAsync } from "../services/makecodeEditorService";

export async function loadProjectAsync(projectId: string, bool: boolean) {
    const { dispatch } = stateAndDispatch();
    await setHighContrastAsync(bool);
    postNotification(makeNotification(`project ${projectId} evaluated`, 2000));

}
