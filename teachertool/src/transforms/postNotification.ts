import { stateAndDispatch } from "../state";
import { NotificationWithId } from "../types";
import * as Actions from "../state/actions";

export function postNotification(notification: NotificationWithId) {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.postNotification(notification));
}
