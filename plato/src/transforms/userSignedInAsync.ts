import { stateAndDispatch } from "@/state";
import { showToast } from "@/state/actions";
import { makeToast } from "@/components/Toaster";
import { Strings } from "@/constants";

export async function userSignedInAsync(name: string) {
    const { dispatch } = stateAndDispatch();
    try {
        dispatch(
            showToast(
                makeToast({
                    type: "success",
                    text: Strings.WelcomeUserFmt(name),
                    timeoutMs: 5000,
                })
            )
        );
    } catch {
    } finally {
    }
}
