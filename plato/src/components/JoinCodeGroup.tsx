import css from "./styling/NetView.module.scss";
import sharedcss from "./styling/Shared.module.scss";
import { useContext, useMemo } from "react";
import { AppStateContext } from "@/state/Context";
import { Button } from "react-common/components/controls/Button";
import { classList } from "react-common/components/util";
import { debounce } from "@/utils";
import { showToast } from "@/transforms";
import { makeToast } from "./Toaster";

export function JoinCodeGroup() {
    const context = useContext(AppStateContext);
    const { state, dispatch } = context;
    const { netState } = state;

    const joinCode = useMemo(() => {
        if (!netState) return "";
        return netState.joinCode || "------";
    }, [netState]);

    const debounceCopyJoinCode = useMemo(
        () =>
            debounce(() => {
                if (!netState || !netState.joinCode) return;
                navigator.clipboard.writeText(netState.joinCode).then(
                    () => {
                        showToast(
                            makeToast({
                                type: "info",
                                icon: "✔️",
                                text: lf("Join code copied to clipboard"),
                                timeoutMs: 2000,
                            })
                        );
                    },
                    () => {
                        // Failure
                    }
                );
            }, 250),
        [netState]
    );

    const debounceCopyJoinLink = useMemo(
        () =>
            debounce(() => {
                if (!netState || !netState.joinCode) return;
                // Get the domain and path from the current URL
                const domain = window.location.origin;
                const path = window.location.pathname;
                // Construct the full URL
                const fullUrl = `${domain}${path}?join=${netState.joinCode}`;
                // Copy the URL to the clipboard
                navigator.clipboard.writeText(fullUrl).then(
                    () => {
                        showToast(
                            makeToast({
                                type: "info",
                                icon: "✔️",
                                text: lf("Join link copied to clipboard"),
                                timeoutMs: 2000,
                            })
                        );
                    },
                    () => {
                        // Failure
                    }
                );
            }, 250),
        [netState]
    );

    if (!netState) {
        return null;
    }

    return (
        <div className={css["join-code-group"]}>
            <p className={css["label"]}>
                {lf("Join Code")}
                <i className={classList(css["help"], "fas fa-question-circle")} onClick={() => { }}></i>
            </p>
            <div className={classList(sharedcss["horz"], sharedcss["wrap"])} >
                <Button
                    className={css["join-code"]}
                    label={joinCode}
                    title={lf("Join Code")}
                    onClick={debounceCopyJoinCode}
                />
                <Button
                    className={sharedcss["button"]}
                    label={lf("Code")}
                    title={lf("Copy Code")}
                    leftIcon="fas fa-copy"
                    onClick={debounceCopyJoinCode}
                />
                <Button
                    className={sharedcss["button"]}
                    label={lf("Link")}
                    title={lf("Copy Link")}
                    leftIcon="fas fa-copy"
                    onClick={debounceCopyJoinLink}
                />
            </div>
        </div>
    );
}