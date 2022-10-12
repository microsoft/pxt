import { useCallback, useContext, useRef, useMemo, useState } from "react";
import { AppStateContext } from "../state/AppStateContext";
import { hostGameAsync, startGameAsync, leaveGameAsync } from "../epics";
import { Input } from "../../../react-common/components/controls/Input";
import { Button } from "../../../react-common/components/controls/Button";
import Presence from "./Presence";
import Reactions from "./Reactions";
import ArcadeSimulator from "./ArcadeSimulator";
import { dispatch } from "../state";
import { showToast } from "../state/actions";

export default function Render() {
    const { state } = useContext(AppStateContext);
    const { appMode } = state;
    const { netMode } = appMode;

    const inputRef = useRef<HTMLInputElement>(null);

    const onHostGameClick = async () => {
        if (inputRef.current) {
            const gameId = pxt.Cloud.parseScriptId(inputRef.current.value);
            if (gameId) {
                await hostGameAsync(gameId);
            } else {
                dispatch(
                    showToast({
                        type: "error",
                        text: lf("Invalid share code"),
                        timeoutMs: 5000,
                    })
                );
            }
        }
    };

    const onStartGameClick = async () => {
        await startGameAsync();
    };

    const onLeaveGameClick = async () => {
        await leaveGameAsync();
    };

    return (
        <>
            <div className="tw-mt-2 tw-h-max">
                <div className="tw-text-2xl tw-font-bold">{"Hosting a Game"}</div>
                {netMode === "init" && (
                    <div className="tw-flex tw-flex-row tw-gap-1 tw-items-end">
                        <Input
                            label={lf("Game URL or Share Code")}
                            title={lf("Game URL or Share Code")}
                            autoComplete={false}
                            handleInputRef={inputRef}
                            preserveValueOnBlur={true}
                            onEnterKey={onHostGameClick}
                        />
                        <Button
                            className={"teal"}
                            label={lf("Host")}
                            title={lf("Host")}
                            onClick={onHostGameClick}
                        />
                    </div>
                )}
                {netMode === "connecting" && (
                    <div className="tw-text-lg tw-font-bold tw-mt-5">
                        {lf("Connecting")}
                    </div>
                )}
                {netMode === "connected" && (
                    <div className="tw-flex tw-flex-col tw-gap-1">
                        <div className="tw-mt-5">
                            Join Code:{" "}
                            <span className="tw-p-2 tw-tracking-[.25rem] tw-border-1 tw-border-black tw-bg-slate-600 tw-solid tw-rounded tw-text-white">
                                {state.gameState?.joinCode}
                            </span>
                        </div>
                        {state.gameState?.gameMode === "lobby" && (
                            <div className="tw-mt-5">
                                <div className="tw-text-lg tw-font-bold">
                                    {lf("In the lobby")}
                                </div>
                                <Button
                                    className={"teal"}
                                    label={lf("Start Game")}
                                    title={lf("Start Game")}
                                    onClick={onStartGameClick}
                                />
                            </div>
                        )}
                        <div className="tw-mt-1">
                            <Button
                                className={"gray"}
                                label={lf("Leave Game")}
                                title={lf("Leave Game")}
                                onClick={onLeaveGameClick}
                            />
                        </div>
                    </div>
                )}
            </div>
            {state.gameState?.gameMode === "playing" && <ArcadeSimulator />}
            {state.gameState?.gameMode && (
                <>
                    <div className="tw-mt-5">
                        <Presence />
                    </div>
                    <div className="tw-mt-5">
                        <Reactions />
                    </div>
                </>
            )}
        </>
    );
}
