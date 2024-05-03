import { stateAndDispatch } from "../state";
import { Checklist } from "../types/checklist";
import * as Actions from "../state/actions";
import * as AutorunService from "../services/autorunService";
import { setEvalResultsToNotStarted } from "./setEvalResultsToNotStarted";

export function setChecklist(checklist: Checklist) {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.setChecklist(checklist));
    setEvalResultsToNotStarted({ checklist });
    AutorunService.poke();
}
