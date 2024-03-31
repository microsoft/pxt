import * as collabClient from "../services/collabClient";
import { dispatch } from "../state";
import { dismissToast, setNetMode, setCollabInfo, showToast, setClientRole } from "../state/actions";

export async function hostCollabAsync() {
    const connectingToast = showToast({
        type: "info",
        text: lf("Connecting..."),
        showSpinner: true,
    });
    try {
        dispatch(setNetMode("connecting"));
        dispatch(connectingToast);

        const hostResult = await collabClient.hostCollabAsync();
        pxt.debug(hostResult);

        if (hostResult.success) {
            dispatch(
                showToast({
                    type: "success",
                    text: lf("Connected!"),
                    timeoutMs: 5000,
                })
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
            showToast({
                type: "error",
                text: lf("Something went wrong. Please try again."),
                timeoutMs: 5000,
            })
        );
        dispatch(setNetMode("init"));
    } finally {
        dispatch(dismissToast(connectingToast.toast.id));
    }
}
