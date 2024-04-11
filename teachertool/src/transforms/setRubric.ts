import { stateAndDispatch } from "../state";
import { Rubric } from "../types/rubric";
import * as Actions from "../state/actions";
import * as AutorunService from "../services/autorunService";
import { setEvalResultsToNotStarted } from "./setEvalResultsToNotStarted";

export function setRubric(rubric: Rubric) {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.setRubric(rubric));
    setEvalResultsToNotStarted({ rubric });
    AutorunService.poke();
}
