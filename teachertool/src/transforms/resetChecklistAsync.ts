import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { makeChecklist } from "../utils";
import { replaceActiveChecklistAsync } from "./replaceActiveChecklistAsync";

export async function resetChecklistAsync() {
    const { dispatch } = stateAndDispatch();

    if (await replaceActiveChecklistAsync(makeChecklist())) {
        dispatch(Actions.clearAllEvalResults());
    }
}
