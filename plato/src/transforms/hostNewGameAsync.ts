import * as collabClient from "@/services/collabClient";
import { stateAndDispatch } from "@/state";
import { setViewState } from "@/state/actions";
import { initialHostViewState } from "@/state/state";
import { makeToast } from "@/components/Toaster";
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
        const hostResult = await collabClient.hostCollabAsync();

        if (!hostResult.success) {
            showToast(makeToast({
                type: "error",
                text: lf("Connection failed."),
                timeoutMs: 5000,
            }));
            dispatch(setViewState(undefined));
            return;
        }

        showToast(makeToast({
            type: "success",
            text: lf("Connected!"),
            timeoutMs: 5000,
        }));

        const { state } = stateAndDispatch();
        dispatch(setViewState({
            ...state.viewState!,
            joinCode: hostResult.joinCode,
        }));

    } catch {
        dispatch(setViewState(undefined));
    } finally {
        dismissToast(connectingToast.id);
    }
}
