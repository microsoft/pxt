import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";
import { makeRubric } from "../utils";
import { replaceActiveRubricAsync } from "./replaceActiveRubricAsync";

export async function resetRubricAsync() {
    const { dispatch } = stateAndDispatch();

    if (await replaceActiveRubricAsync(makeRubric())) {
        dispatch(Actions.clearAllEvalResults());
    }
}
