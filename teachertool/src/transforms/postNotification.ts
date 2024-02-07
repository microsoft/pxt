import { stateAndDispatch } from "../state";
import { ToastWithId } from "../types";
import * as Actions from "../state/actions";

export function postNotification(notification: ToastWithId) {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.postNotification(notification));
}
