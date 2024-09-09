import { logDebug } from "../services/loggingService";
import { stateAndDispatch } from "../state";
import * as actions from "../state/actions";
import { hideModal } from "./hideModal";
import { showModal } from "./showModal";

export function setUserProfile(profile: pxt.auth.UserProfile | undefined) {
    const { state, dispatch } = stateAndDispatch();

    // Sometimes profile comes in as an empty object. In that case, we should treat it as undefined.
    const newProfile = profile?.id ? profile : undefined;
    logDebug("Set user profile", {
        oldProfile: state.userProfile,
        incomingProfile: profile,
        finalProfile: newProfile,
    });

    dispatch(actions.setUserProfile(newProfile));
    if (!newProfile) {
        showModal({
            modal: "sign-in",
        });
    } else if (state.modalOptions?.modal === "sign-in") {
        hideModal();
    }
}
