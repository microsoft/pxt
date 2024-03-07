import { stateAndDispatch } from "../state";
import { setEvalResultsPending } from "./setEvalResultsPending";
import * as Actions from "../state/actions";

export function initNewProjectResults() {
    const { dispatch } = stateAndDispatch();
    setEvalResultsPending({ overwriteExistingEntries: true });
    dispatch(Actions.clearAllEvalResultNotes());
}
