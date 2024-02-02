import { stateAndDispatch } from "../state";
import { Rubric } from "../types/rubric";
import * as Actions from "../state/actions";

export function setRubric(rubric: Rubric) {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.setRubric(rubric));
}