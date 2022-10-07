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
            <div className="mt-2 h-max">
                <div className="text-2xl font-bold">{"Hosting a Game"}</div>
                {netMode === "init" && (
                    <div className="flex flex-row gap-1 items-end">
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
                    <div className="text-lg font-bold mt-5">
                        {lf("Connecting")}
                    </div>
                )}
                {netMode === "connected" && (
                    <div className="flex flex-col gap-1">
                        <div className="mt-5">
                            Join Code:{" "}
                            <span className="p-2 tracking-[.25rem] border-1 border-black bg-slate-600 solid rounded text-white">
                                {state.gameState?.joinCode}
                            </span>
                        </div>
                        {state.gameState?.gameMode === "lobby" && (
                            <div className="mt-5">
                                <div className="text-lg font-bold">
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
                        <div className="mt-1">
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
            {state.gameState?.gameMode === "playing" && (
                <ArcadeSimulator />
            )}
            {state.gameState?.gameMode && (
                <>
                    <div className="mt-5">
                        <Presence />
                    </div>
                    <div className="mt-5">
                        <Reactions />
                    </div>
                </>
            )}
        </>
    );
}
