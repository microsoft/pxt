import { stateAndDispatch } from "@/state";
import { setUserProfile } from "@/state/actions";

export async function setUserProfileAsync(profile: pxt.auth.UserProfile | undefined) {
    const { dispatch } = stateAndDispatch();
    try {
        dispatch(setUserProfile(profile));
    } catch {
    } finally {
    }
}
