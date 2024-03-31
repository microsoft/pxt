import { useContext, useEffect, useRef } from "react";
import { AppStateContext } from "../state/AppStateContext";
import { SimMultiplayer } from "../types";
import * as gameClient from "../services/gameClient";
// eslint-disable-next-line import/no-unassigned-import
import "./ArcadeSimulator.css";
import {
    simDriver,
    preloadSim,
    simulateAsync,
    buildSimJsInfo,
    RunOptions,
} from "../services/simHost";
import { state as currentState } from "../state";

let builtSimJsInfo: Promise<pxtc.BuiltSimJsInfo | undefined> | undefined;

export default function Render() {
    const { state } = useContext(AppStateContext);
    const { playerSlot, gameState, clientRole, gamePaused } = state;
    const gameId = gameState?.gameId;
    const gameMode = gameState?.gameMode;
    const simContainerRef = useRef<HTMLDivElement>(null);

    const playerThemes = [
        "background-color=ED3636&button-stroke=8D2525",
        "background-color=4E4EE9&button-stroke=3333A1",
        "background-color=FF9A14&button-stroke=B0701A",
        "background-color=4EB94E&button-stroke=245D24",
    ];
    const selectedPlayerTheme = playerThemes[(playerSlot || 0) - 1];
    const isHost = clientRole === "host";

    const postImageMsg = async (msg: SimMultiplayer.ImageMessage) => {
        const { image, palette } = msg;
        const { data } = image;

        await gameClient.sendScreenUpdateAsync(data, palette);
    };

    const postInputMsg = async (msg: SimMultiplayer.InputMessage) => {
        const { button, state } = msg;
        await gameClient.sendInputAsync(button, state);
    };

    const postAudioMsg = async (msg: SimMultiplayer.AudioMessage) => {
        const { instruction, soundbuf } = msg;
        await gameClient.sendAudioAsync(instruction, soundbuf);
    };
    const postIconMsg = async (msg: SimMultiplayer.MultiplayerIconMessage) => {
        const { iconType, palette, icon, slot } = msg;
        const { data } = icon || {};
        await gameClient.sendIconAsync(iconType, slot, palette, data);
    };

    const setSimStopped = async () => {
        simDriver()?.resume(pxsim.SimulatorDebuggerCommand.Pause);
    };

    const setSimResumed = async () => {
        simDriver()?.resume(pxsim.SimulatorDebuggerCommand.Resume);
    };

    useEffect(() => {
        const msgHandler = (
            msg: MessageEvent<
                | SimMultiplayer.Message
                | pxsim.SimulatorStateMessage
                | pxsim.SimulatorTopLevelCodeFinishedMessage
            >
        ) => {
            const { data } = msg;
            const { type } = data;

            switch (type) {
                case "status":
                    // Once the simulator is ready, if this player is a guest, pass initial screen to simulator
                    const { state: simState } = data;
                    if (simState === "running" && clientRole === "guest") {
                        const { image, palette } =
                            gameClient.getCurrentScreen();
                        if (image) {
                            simDriver()?.postMessage({
                                type: "multiplayer",
                                content: "Image",
                                image: {
                                    data: image,
                                },
                                palette,
                            } as SimMultiplayer.ImageMessage);
                        }
                        // uncomment for local testing of 'fake players'
                        // gameClient.startPostingRandomKeys();
                    }
                    return;
                case "toplevelcodefinished": {
                    // broadcast initial presence state
                    if (clientRole === "host") {
                        for (const player of currentState?.presence.users) {
                            simDriver()?.postMessage({
                                type: "multiplayer",
                                content: "Connection",
                                slot: player.slot,
                                connected: true,
                            } as SimMultiplayer.MultiplayerConnectionMessage);
                        }
                    }
                    return;
                }
                case "multiplayer":
                    const { origin, content } = data;
                    if (origin === "client" && content === "Button") {
                        postInputMsg(data);
                    } else if (origin === "server" && content === "Image") {
                        postImageMsg(data);
                    } else if (origin === "server" && content === "Audio") {
                        postAudioMsg(data);
                    } else if (origin === "server" && content === "Icon") {
                        postIconMsg(data);
                    }
                    return;
            }
        };

        window.addEventListener("message", msgHandler);
        return () => window.removeEventListener("message", msgHandler);
    }, [clientRole]);

    const getOpts: () => RunOptions = () => {
        let opts: RunOptions;

        if (isHost) {
            opts = {
                simQueryParams: selectedPlayerTheme,
                mpRole: "server",
                id: gameId!,
            };
        } else {
            opts = {
                simQueryParams: selectedPlayerTheme,
                mpRole: "client",
            };
        }

        return opts;
    };

    const compileSimCode = async () => {
        builtSimJsInfo = buildSimJsInfo(getOpts());
        return await builtSimJsInfo;
    };

    const runSimulator = async () => {
        const simOpts = getOpts();
        if (builtSimJsInfo) {
            simOpts.builtJsInfo = await builtSimJsInfo;
        }

        builtSimJsInfo = simulateAsync(simContainerRef.current!, simOpts);

        await builtSimJsInfo;
    };

    useEffect(() => {
        if (gameMode === "playing") {
            runSimulator();
        }
    }, [gameMode]);

    useEffect(() => {
        if (gameMode !== "playing" && simContainerRef.current) {
            preloadSim(simContainerRef.current, getOpts());
        }
    }, [clientRole, playerSlot]);

    useEffect(() => {
        if (!isHost) {
            compileSimCode();
        }
    }, [clientRole]);

    useEffect(() => {
        if (isHost && gameId) {
            compileSimCode();
        }
    }, [clientRole, gameId]);

    useEffect(() => {
        return () => {
            builtSimJsInfo = undefined;
        };
    });

    return (
        <div
            id="sim-container"
            ref={simContainerRef}
            className="tw-grow tw-w-screen md:tw-w-[calc(100vw-6rem)]"
            style={{
                filter: gamePaused ? "grayscale(70%) blur(1px)" : "none",
                transition: "filter .25s",
            }}
        />
    );
}
