import { runEvalInEditorAsync } from "../services/makecodeEditorService";
import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { makeNotification } from "../utils";
import { postNotification } from "./postNotification";

export async function runEvaluateAsync(rubric: string) {
    const { dispatch } = stateAndDispatch();

    // TODO : Loading screen type thing
    const evalResult = await runEvalInEditorAsync(rubric);
    // TODO : clear loading

    if (evalResult) {
        dispatch(Actions.setEvalResult(evalResult));
    } else {
        postNotification(makeNotification(lf("Unable to evaluate project"), 2000));
    }
}