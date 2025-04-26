import * as collabClient from "@/services/collabClient";
import { stateAndDispatch } from "@/state";
import { setViewState } from "@/state/actions";
import { initialHostViewState } from "@/state/state";
import { makeToast } from "@/components/Toaster";
import { delayAsync } from "@/utils";
import { showToast, dismissToast } from ".";

export async function hostNewGameAsync() {
    const { dispatch } = stateAndDispatch();
    const connectingToast = makeToast({
        type: "info",
        text: lf("Connecting..."),
        showSpinner: true,
    });

    try {
        showToast(connectingToast);
        dispatch(setViewState(initialHostViewState));
        await delayAsync(10000);
        dispatch(setViewState(undefined));
    } catch {
    } finally {
        dismissToast(connectingToast.id);
    }
}
