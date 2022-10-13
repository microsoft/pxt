import { dispatch } from "../state";
import { clearUserProfile, setUiMode, setUserProfile } from "../state/actions";

export async function setUserProfileAsync(
    profile: pxt.auth.UserProfile | undefined
) {
    try {
        if (profile) {
            dispatch(setUserProfile(profile));
        } else {
            dispatch(clearUserProfile());
        }
        dispatch(setUiMode("home"));
    } catch (e) {
    } finally {
    }
}
