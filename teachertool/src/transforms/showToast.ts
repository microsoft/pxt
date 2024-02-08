import { stateAndDispatch } from "../state";
import { ToastWithId } from "../types";
import * as Actions from "../state/actions";

export function showToast(toast: ToastWithId) {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.showToast(toast));
}
