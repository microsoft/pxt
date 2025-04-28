import css from "./styling/NetView.module.scss";
import { useContext, useMemo } from "react";
import { AppStateContext } from "@/state/Context";
import { getHostNetState } from "@/state/helpers";
import { Input } from "react-common/components/controls/Input";
import { Button } from "react-common/components/controls/Button";
import { classList } from "react-common/components/util";
import { debounce } from "@/utils";
import { showToast } from "@/transforms";
import { makeToast } from "./Toaster";
import * as collabClient from "@/services/collabClient";
import { setNetState } from "@/state/actions";
import { Strings } from "@/constants";
import { ViewPlayer } from "@/types";

export function HostView() {
    const context = useContext(AppStateContext);
    const { state, dispatch } = context;
    const netState = getHostNetState(context);

    const presence = useMemo(() => {
        if (!netState) return { users: [] };
        return netState.presence;
    }, [netState]);

    const players: ViewPlayer[] = useMemo(() => {
        if (!netState) return [];
        return presence.users.sort((a, b) => a.slot - b.slot).map((u) => ({
            id: u.id,
            name: u.kv?.get("name") || Strings.MissingName,
            isHost: u.slot === 1,
            isMe: u.id === netState.clientId,
        }));
    }, [presence, netState]);

    const joinCode = useMemo(() => {
        if (!netState) return "";
        return netState.joinCode || "------";
    }, [netState]);

    const debounceCopyJoinCode = useMemo(() => debounce(() => {
        if (!netState || !netState.joinCode) return;
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
    }, 250), [netState]);

    if (!netState) {
        return null;
    }

    return (
        <div className={css["view"]}>
            <div className={classList(css["panel"], css["controls"])}>
                <p className={css["label"]}>{lf("Game Link")}<i className={classList(css["help"], "fas fa-question-circle")} onClick={() => { }}></i></p>
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
                <p className={css["label"]}>{lf("Join Code")}<i className={classList(css["help"], "fas fa-question-circle")} onClick={() => { }}></i></p>
                <div className={css["join-code-group"]}>
                    <Button
                        className={css["join-code"]}
                        label={joinCode}
                        title={lf("Join Code")}
                        onClick={() => debounceCopyJoinCode()}
                    />
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
                        label={lf("End Game")}
                        title={lf("End Game")}
                        onClick={() => {
                            collabClient.collabOver("ended");
                            dispatch(setNetState(undefined));
                        }}
                    />
                </div>
            </div>
            <div className={classList(css["panel"], css["presence"])}>
                <p className={css["label"]}>{lf("Players")}</p>
                <div className={css["players"]}>
                    {players.map((p) => (
                        <div key={p.id} className={css["player"]}>
                            <span className={css["name"]}>{p.name}</span>
                            {p.isHost && <span className={css["host"]}>{lf("host")}</span>}
                            {p.isMe && <span className={css["me"]}>{lf("me")}</span>}
                            <Button
                                className={css["actions"]}
                                title={lf("Actions")}
                                leftIcon="fas fa-ellipsis-v"
                                onClick={() => { }}
                            />
                        </div>
                    ))}
                </div>
            </div>
            <div className={classList(css["panel"], css["sim"])}>
            </div>
        </div>
    )
}
