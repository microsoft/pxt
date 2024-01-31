import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";

export function setRubricName(name: string) {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.setRubricName(name));
}