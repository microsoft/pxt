import { useCallback, useContext, useRef, useMemo, useState } from "react";
import { AppStateContext } from "../state/AppStateContext";
import { joinGameAsync, leaveGameAsync } from "../epics";
import { Input } from "../../../react-common/components/controls/Input";
import { Button } from "../../../react-common/components/controls/Button";
import Presence from "./Presence";
import Reactions from "./Reactions";

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
            <div className="tw-mt-2">
                <div className="tw-text-2xl tw-font-bold">{"Joining a Game"}</div>
                {netMode === "init" && (
                    <div className="tw-flex tw-flex-row tw-gap-1 tw-items-end">
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
                    <div className="tw-text-lg tw-font-bold tw-mt-5">
                        {lf("Connecting")}
                    </div>
                )}
                {netMode === "connected" && (
                    <div className="tw-flex tw-flex-col tw-gap-1">
                        {state.gameState?.gameMode === "lobby" && (
                            <div className="tw-mt-5">
                                <div className="tw-text-lg tw-font-bold">
                                    {lf("In the lobby")}
                                </div>
                            </div>
                        )}
                        {state.gameState?.gameMode === "playing" && (
                            <div className="tw-mt-5">
                                <div className="tw-text-lg tw-font-bold">
                                    {lf("Game Started!")}
                                </div>
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
            <div className="tw-grow" />
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
