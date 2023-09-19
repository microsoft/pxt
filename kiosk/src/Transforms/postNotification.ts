import { stateAndDispatch } from "../State";
import { Notification } from "../Types";
import * as Actions from "../State/Actions";
import { playSoundEffect } from "../Services/SoundEffectService";

export function postNotification(notification: Notification) {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.postNotification(notification));
    playSoundEffect("notification");
}
