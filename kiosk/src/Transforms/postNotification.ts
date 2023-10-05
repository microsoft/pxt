import { stateAndDispatch } from "../State";
import { NotificationWithId } from "../Types";
import * as Actions from "../State/Actions";
import { playSoundEffect } from "../Services/SoundEffectService";

export function postNotification(notification: NotificationWithId) {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.postNotification(notification));
    playSoundEffect("notification");
}
