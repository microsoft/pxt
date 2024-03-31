import * as collabClient from "../services/collabClient";
import { dispatch } from "../state";
import { dismissToast, setNetMode, setCollabInfo, showToast, setClientRole } from "../state/actions";
import { HTTP_SESSION_FULL, HTTP_SESSION_NOT_FOUND } from "../types";
import { cleanupJoinCode } from "../util";
import { notifyDisconnected } from ".";

export async function joinCollabAsync(joinCode: string | undefined) {
    joinCode = cleanupJoinCode(joinCode);
    if (!joinCode) {
        return dispatch(
            showToast({
                type: "error",
                text: lf("Invalid join code. Please try again."),
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

        const joinResult = await collabClient.joinCollabAsync(joinCode);
        pxt.debug(joinResult);

        if (joinResult.success) {
            dispatch(
                showToast({
                    type: "success",
                    text: lf("Connected!"),
                    timeoutMs: 5000,
                })
            );
            dispatch(setClientRole("guest"));
            dispatch(
                setCollabInfo({
                    joinCode,
                    ...joinResult,
                })
            );
            dispatch(setNetMode("connected"));
        } else {
            if (joinResult.statusCode === HTTP_SESSION_NOT_FOUND) {
                notifyDisconnected("not-found");
                dispatch(setNetMode("init"));
            } else if (joinResult.statusCode === HTTP_SESSION_FULL) {
                // notification handled by collabClient
                dispatch(setNetMode("init"));
            } else {
                throw new Error(`join http response: ${joinResult.statusCode}`);
            }
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
