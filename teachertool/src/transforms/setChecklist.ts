import { stateAndDispatch } from "../state";
import { Checklist } from "../types/checklist";
import * as Actions from "../state/actions";
import { setEvalResultsToNotStarted } from "./setEvalResultsToNotStarted";

export function setChecklist(checklist: Checklist) {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.setChecklist(checklist));
    setEvalResultsToNotStarted({ checklist });
}
