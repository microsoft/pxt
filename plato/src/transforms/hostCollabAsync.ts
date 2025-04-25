import * as collabClient from "@/services/collabClient";
import { stateAndDispatch } from "@/state";
import { dismissToast, setNetMode, setCollabInfo, showToast, setClientRole } from "@/state/actions";
import { makeToast } from "@/components/Toaster";

export async function hostCollabAsync() {
    const { dispatch } = stateAndDispatch();
    const connectingToast = makeToast({
        type: "info",
        text: lf("Connecting..."),
        showSpinner: true,
    });
    try {
        dispatch(setNetMode("connecting"));
        dispatch(showToast(connectingToast));

        const hostResult = await collabClient.hostCollabAsync();
        pxt.debug(hostResult);

        if (hostResult.success) {
            dispatch(
                showToast(
                    makeToast({
                        type: "success",
                        text: lf("Connected!"),
                        timeoutMs: 5000,
                    })
                )
            );
            dispatch(setClientRole("host"));
            dispatch(setCollabInfo(hostResult));
            dispatch(setNetMode("connected"));
        } else {
            throw new Error(`host http response: ${hostResult.statusCode}`);
        }
    } catch (e: any) {
        pxt.log(e.toString());
        dispatch(
            showToast(
                makeToast({
                    type: "error",
                    text: lf("Something went wrong. Please try again."),
                    timeoutMs: 5000,
                })
            )
        );
        dispatch(setNetMode("init"));
    } finally {
        dispatch(dismissToast(connectingToast.id));
    }
}
