import { runEvalInEditorAsync } from "../services/makecodeEditorService";
import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { makeNotification } from "../utils";
import { postNotification } from "./postNotification";

export async function runEvaluateAsync() {
    const { state: teacherTool, dispatch } = stateAndDispatch();

    const evalResult = await runEvalInEditorAsync(teacherTool.selectedCriteria, teacherTool.catalog!);
    if (evalResult) {
        dispatch(Actions.setEvalResult(evalResult));
    } else {
        // Errors already logged in the runEvalInEditorAsync function.
        // Just notify the user.
        postNotification(makeNotification(lf("Unable to evaluate project"), 2000));
    }
}