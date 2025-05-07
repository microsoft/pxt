import * as collabClient from "@/services/collabClient";
import { stateAndDispatch } from "@/state";
import { setNetState, dismissAllToasts } from "@/state/actions";
import { initialHostNetState } from "@/state/state";
import { makeToast } from "@/components/Toaster";
import { showToast, dismissToast } from ".";

export async function hostSessionAsync() {
    const { dispatch } = stateAndDispatch();
    const connectingToast = makeToast({
        type: "info",
        text: lf("Connecting..."),
        showSpinner: true,
    });

    try {
        dispatch(dismissAllToasts());
        showToast(connectingToast);
        dispatch(setNetState(initialHostNetState()));
        const hostResult = await collabClient.hostCollabAsync();

        if (!hostResult.success) {
            showToast(
                makeToast({
                    type: "error",
                    text: lf("Connection failed."),
                    timeoutMs: 5000,
                })
            );
            dispatch(setNetState(undefined));
            return;
        }

        showToast(
            makeToast({
                type: "success",
                text: lf("Connected!"),
                timeoutMs: 5000,
            })
        );

        const { state } = stateAndDispatch();
        dispatch(
            setNetState({
                ...state.netState!,
                joinCode: hostResult.joinCode,
            })
        );
    } catch {
        dispatch(setNetState(undefined));
    } finally {
        dismissToast(connectingToast.id);
    }
}
