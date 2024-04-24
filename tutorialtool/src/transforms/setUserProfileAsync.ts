import { stateAndDispatch } from "../state";
import { clearUserProfile, setUserProfile } from "../state/actions";

export async function setUserProfileAsync(
    profile: pxt.auth.UserProfile | undefined
) {
    const { dispatch } = stateAndDispatch();
    try {
        if (profile) {
            dispatch(setUserProfile(profile));
        } else {
            dispatch(clearUserProfile());
        }
    } catch (e) {
    } finally {
    }
}
