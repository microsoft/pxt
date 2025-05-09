import css from "./styling/NetView.module.scss";
import sharedcss from "./styling/Shared.module.scss";
import { useContext, useMemo, useRef } from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim"
import { AppStateContext } from "@/state/Context";
import { getHostNetState } from "@/state/helpers";
import { Input } from "react-common/components/controls/Input";
import { Button } from "react-common/components/controls/Button";
import { classList } from "react-common/components/util";
import { debounce, generateRandomName } from "@/utils";
import { showToast, startLoadingGame } from "@/transforms";
import { makeToast } from "./Toaster";
import * as collabClient from "@/services/collabClient";
import { setNetState } from "@/state/actions";
import { ViewPlayer } from "@/types";
import { Strings } from "@/constants";
import { ArcadeSimulator } from "./ArcadeSimulator";

export function HostView() {
    const context = useContext(AppStateContext);
    const gameLinkRef = useRef<HTMLInputElement>(null);
    const { state, dispatch } = context;
    const netState = getHostNetState(context);
    const presence = useSyncExternalStore(
        collabClient.playerPresenceStore.subscribe,
        collabClient.playerPresenceStore.getSnapshot,
    );

    const players: ViewPlayer[] = useMemo(() => {
        if (!netState) return [];
        return presence
            .sort((a, b) => a.id.localeCompare(b.id));
    }, [presence, netState]);

    const me: ViewPlayer | undefined = useMemo(() => {
        if (!netState) return undefined;
        return players.find(p => p.isMe);
    }, [players, netState]);

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

    const loadGame = () => {
        const gameLink = gameLinkRef.current?.value;
        const shareCode = pxt.Cloud.parseScriptId(gameLink || "");
        if (!shareCode) return;
        startLoadingGame(shareCode);
    };

    return (
        <div className={css["view"]}>
            <div className={classList(css["panel"], css["controls"])}>
                <p className={css["label"]}>
                    {lf("Game Link")}
                    <i className={classList(css["help"], "fas fa-question-circle")} onClick={() => { }}></i>
                </p>
                <div className={css["share-link"]}>
                    <Input className={css["share-link"]} handleInputRef={gameLinkRef} placeholder="Paste your game link here" />
                    <Button className={css["load"]} label={lf("Load")} title={lf("Load")} onClick={loadGame} />
                </div>
                <p></p>
                <p></p>
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
                        label={lf("Copy Code")}
                        title={lf("Copy Code")}
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
                    <p className={css["label"]}>{lf("{id:name}Me: {0}", me?.name || Strings.MissingName)}</p>
                    <div className={sharedcss["horz"]}>
                        <Button
                            className={sharedcss["button"]}
                            label={lf("Change Name")}
                            title={lf("Change Name")}
                            onClick={() => {
                                const name = generateRandomName();
                                collabClient.setName(name);
                            }}
                        />
                        <Button
                            className={sharedcss["button"]}
                            label={lf("Change Sprite")}
                            title={lf("Change Sprite")}
                            onClick={() => { }}
                        />
                    </div>
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
