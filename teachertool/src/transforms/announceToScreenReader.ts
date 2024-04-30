import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";

export function announceToScreenReader(announcement: string) {
    const { dispatch } = stateAndDispatch();
    dispatch(Actions.setScreenReaderAnnouncement(announcement));
}
