import { stateAndDispatch } from "../state";
import { Rubric } from "../types/rubric";
import * as Actions from "../state/actions";
import * as AutorunService from "../services/autorunService";
import { setEvalResultsPending } from "./setEvalResultsPending";

export function setRubric(rubric: Rubric) {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.setRubric(rubric));
    setEvalResultsPending()
    AutorunService.poke();
}
