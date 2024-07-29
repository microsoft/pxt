import { stateAndDispatch } from "../state";
import * as actions from "../state/actions";
import { showModal } from "./showModal";

export function setUserProfile(profile: pxt.auth.UserProfile | undefined) {
    const { dispatch } = stateAndDispatch();

    if (!pxt.BrowserUtils.isLocalHost() || profile !== undefined) {
        dispatch(actions.setUserProfile(profile));
        if (!profile) {
            showModal({
                modal: "sign-in"
            })
        };
    }

}
