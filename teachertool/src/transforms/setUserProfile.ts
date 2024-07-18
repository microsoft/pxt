import * as actions from "../state/actions";
import { showModal } from "./showModal";

export function setUserProfile(profile: pxt.auth.UserProfile | undefined) {
    actions.setUserProfile(profile);

    if (!profile) {
        showModal({
            modal: "sign-in"
        })
    };
}
