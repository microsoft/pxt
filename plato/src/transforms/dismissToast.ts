import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";

export function dismissToast(id: string) {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.dismissToast(id));
}
