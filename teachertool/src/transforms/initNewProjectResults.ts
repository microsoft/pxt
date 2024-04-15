import { stateAndDispatch } from "../state";
import { setEvalResultsToNotStarted } from "./setEvalResultsToNotStarted";
import * as Actions from "../state/actions";

export function initNewProjectResults() {
    const { dispatch } = stateAndDispatch();
    setEvalResultsToNotStarted({ overwriteExistingEntries: true });
    dispatch(Actions.clearAllEvalResultNotes());
}
