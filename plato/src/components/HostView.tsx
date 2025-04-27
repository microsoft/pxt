import css from "./HostView.module.scss";
import { useContext } from "react";
import { AppStateContext } from "@/state/Context";
import { HostNetState } from "@/state/state";
import { getClientRole } from "@/state/helpers";
import { Input } from "react-common/components/controls/Input";
import { Button } from "react-common/components/controls/Button";
import { Link } from "react-common/components/controls/Link";
import { classlist, debounce } from "@/utils";
import { showToast } from "@/transforms";
import { makeToast } from "./Toaster";
import * as collabClient from "@/services/collabClient";
import { setNetState } from "@/state/actions";

export function HostView() {
    const context = useContext(AppStateContext);
    const { state, dispatch } = context;
    const clientRole = getClientRole(context);
    const netState = state.netState as HostNetState;

    if (clientRole !== "host" || !netState || netState.type !== "host") {
        return null;
    }

    const debounceCopyJoinCode = debounce(() => {
        if (!netState.joinCode) return;
        navigator.clipboard.writeText(netState.joinCode).then(() => {
            showToast(makeToast({
                type: "info",
                icon: "✔️",
                text: lf("Join code copied to clipboard"),
                timeoutMs: 2000,
            }));
        }, () => {
            // Failure
        });
    }, 250);

    return (
        <div className={css["host-view"]}>
            <div className={classlist(css["panel"], css["controls"])}>
                <p className={css["label"]}>{lf("Game Link")}<i className={classlist(css["help"], "fas fa-question-circle")} onClick={() => { }}></i></p>
                <div className={css["share-link"]}>
                    <Input
                        className={css["share-link"]}
                        placeholder="Paste your game link here"
                    />
                    <Button
                        className={css["load"]}
                        label={lf("Load")}
                        title={lf("Load")}
                        onClick={() => { }}
                    />
                </div>
                <p></p>
                <p></p>
                <p className={css["label"]}>{lf("Join Code")}<i className={classlist(css["help"], "fas fa-question-circle")} onClick={() => { }}></i></p>
                <div className={css["join-code-group"]}>
                    <div className={css["join-code"]} onClick={() => debounceCopyJoinCode()}>
                        {netState.joinCode ?? "------"}
                    </div>
                    <Button
                        className={css["copy"]}
                        label={lf("Copy Code")}
                        title={lf("Copy Code")}
                        onClick={() => debounceCopyJoinCode()}
                    />
                    <Button
                        className={css["copy-link"]}
                        label={lf("Copy Join Link")}
                        title={lf("Copy Join Link")}
                        onClick={() => { }}
                    />
                </div>
                <p></p>
                <p></p>
                <div className={css["me-group"]}>
                    <p className={css["label"]}>{lf("Me")}</p>
                </div>
                <div className={css["leave-group"]}>
                    <Button
                        className={css["exit"]}
                        label={lf("Exit Game")}
                        title={lf("Exit Game")}
                        onClick={() => {
                            collabClient.collabOver("ended");
                            dispatch(setNetState(undefined));
                        }}
                    />
                </div>
            </div>
            <div className={classlist(css["panel"], css["presence"])}>
                <p className={css["label"]}>{lf("Players")}</p>
            </div>
            <div className={classlist(css["panel"], css["sim"])}>
            </div>
        </div>
    )
}
