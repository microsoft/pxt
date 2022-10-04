import { dispatch } from "../state";
import { setUserProfile, clearUserProfile, showToast } from "../state/actions";
import * as authClient from "../services/authClient";

export async function userSignedInAsync(name: string) {
    try {
        dispatch(
            showToast({
                type: "success",
                text: lf("Welcome {0}!", name),
                timeoutMs: 5000,
            })
        );
    } catch (e) {
    } finally {
    }
}
