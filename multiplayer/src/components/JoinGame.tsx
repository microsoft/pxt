import { useCallback, useContext, useRef, useMemo, useState } from "react";
import { AppStateContext } from "../state/AppStateContext";
import { joinGameAsync, leaveGameAsync } from "../epics";
import { Input } from "../../../react-common/components/controls/Input";
import { Button } from "../../../react-common/components/controls/Button";
import Presence from "./Presence";
import Reactions from "./Reactions";
import ArcadeSimulator from "./ArcadeSimulator";

export default function Render() {
    const { state } = useContext(AppStateContext);
    const { appMode } = state;
    const { netMode } = appMode;

    const inputRef = useRef<HTMLInputElement>(null);

    const onJoinGameClick = async () => {
        if (inputRef.current) {
            const joinCode = inputRef.current.value.toUpperCase().trim();
            if (joinCode) {
                await joinGameAsync(joinCode);
            }
        }
    };

    const onLeaveGameClick = async () => {
        await leaveGameAsync();
    };

    return (
        <>
            <div className="mt-2">
                <div className="text-2xl font-bold">{"Joining a Game"}</div>
                {netMode === "init" && (
                    <div className="flex flex-row gap-1 items-end">
                        <Input
                            label={lf("Join Code")}
                            title={lf("Join Code")}
                            autoComplete={false}
                            handleInputRef={inputRef}
                            preserveValueOnBlur={true}
                            onEnterKey={onJoinGameClick}
                        />
                        <Button
                            className={"teal"}
                            label={lf("Join")}
                            title={lf("Join")}
                            onClick={onJoinGameClick}
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
                        {state.gameState?.gameMode === "lobby" && (
                            <div className="mt-5">
                                <div className="text-lg font-bold">
                                    {lf("In the lobby")}
                                </div>
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
            {state.gameState?.gameMode === "playing" && <ArcadeSimulator />}
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
