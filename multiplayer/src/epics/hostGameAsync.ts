import * as gameClient from "../services/gameClient";
import { dispatch } from "../state";
import { dismissToast, setNetMode, setGameInfo, showToast, setClientRole } from "../state/actions";
import { cleanupShareCode } from "../util";

export async function hostGameAsync(shareCode: string | undefined) {
    shareCode = cleanupShareCode(shareCode);
    if (!shareCode) {
        return dispatch(
            showToast({
                type: "error",
                text: lf("Invalid share code or link. Please try again."),
                timeoutMs: 5000,
            })
        );
    }
    const connectingToast = showToast({
        type: "info",
        text: lf("Connecting..."),
        showSpinner: true,
    });
    try {
        dispatch(setNetMode("connecting"));
        dispatch(connectingToast);

        const hostResult = await gameClient.hostGameAsync(shareCode);
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
            dispatch(setGameInfo(hostResult));
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
