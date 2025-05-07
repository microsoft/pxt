import css from "./styling/NetView.module.scss";
import * as collabClient from "@/services/collabClient";
import { useContext, useMemo } from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim"
import { AppStateContext } from "@/state/Context";
import { classList } from "react-common/components/util";
import { getGuestNetState } from "@/state/helpers";
import { ViewPlayer } from "@/types";
import { Keys, Strings } from "@/constants";
import { debounce, generateRandomName } from "@/utils";
import { makeToast } from "./Toaster";
import { showToast } from "@/transforms";
import { Button } from "react-common/components/controls/Button";
import { setNetState } from "@/state/actions";
import { ArcadeSimulator } from "./ArcadeSimulator";

export function GuestView() {
    const context = useContext(AppStateContext);
    const { state, dispatch } = context;
    const netState = getGuestNetState(context);
    const presence = useSyncExternalStore(
        collabClient.playerPresenceStore.subscribe,
        collabClient.playerPresenceStore.getSnapshot,
    );

    const players: ViewPlayer[] = useMemo(() => {
        if (!netState) return [];
        return presence
            .sort((a, b) => a.id.localeCompare(b.id));
    }, [presence, netState]);

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

    if (!netState) {
        return null;
    }

    return (
        <div className={css["view"]}>
            <div className={classList(css["panel"], css["controls"])}>
                <p className={css["label"]}>
                    {lf("Join Code")}
                    <i className={classList(css["help"], "fas fa-question-circle")} onClick={() => { }}></i>
                </p>
                <div className={css["join-code-group"]}>
                    <Button
                        className={css["join-code"]}
                        label={joinCode}
                        title={lf("Join Code")}
                        onClick={() => debounceCopyJoinCode()}
                    />
                    <Button
                        className={css["copy"]}
                        label={lf("Copy")}
                        title={lf("Copy")}
                        onClick={() => debounceCopyJoinCode()}
                    />
                    <Button
                        className={css["copy-link"]}
                        label={lf("Copy Link")}
                        title={lf("Copy Link")}
                        onClick={() => { }}
                    />
                </div>
                <p></p>
                <p></p>
                <div className={css["me-group"]}>
                    <p className={css["label"]}>{lf("Me")}</p>
                    <Button
                        label={lf("Regenerate Name")}
                        title={lf("Regenerate Name")}
                        onClick={() => {
                            const name = generateRandomName();
                            collabClient.setName(name);
                        }}
                    />
                </div>
                <div className={css["leave-group"]}>
                    <Button
                        className={css["exit"]}
                        label={lf("Leave Game")}
                        title={lf("Leave Game")}
                        onClick={async () => {
                            await collabClient.leaveCollabAsync("left");
                            dispatch(setNetState(undefined));
                        }}
                    />
                </div>
            </div>
            <div className={classList(css["panel"], css["presence"])}>
                <p className={css["label"]}>{lf("Players")}</p>
                <div className={css["players"]}>
                    {players.map(p => (
                        <div key={p.id} className={css["player"]}>
                            <span className={css["name"]}>{p.name}</span>
                            {(p.role === "host") && <span className={classList(css["pill"], css["host"])}>{lf("host")}</span>}
                            {p.isMe && <span className={classList(css["pill"], css["me"])}>{lf("me")}</span>}
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
                <ArcadeSimulator />
            </div>
        </div>
    );
}
