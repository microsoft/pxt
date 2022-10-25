import { useContext, useEffect, useRef } from "react";
import { AppStateContext } from "../state/AppStateContext";
import { SimMultiplayer } from "../types";
import * as gameClient from "../services/gameClient";
// eslint-disable-next-line import/no-unassigned-import
import "./ArcadeSimulator.css";

let builtSimJsInfo: Promise<pxtc.BuiltSimJsInfo> | undefined;

export default function Render() {
    const { state } = useContext(AppStateContext);
    const { gameId, playerSlot, gameState, appMode } = state;
    const { uiMode } = appMode;
    const simContainerRef = useRef<HTMLDivElement>(null);

    const playerThemes = [
        "background-color=ED3636&button-stroke=8d2525",
        "background-color=4E4EE9&button-stroke=3333a1",
        "background-color=FFDF1A&button-stroke=c1a916",
        "background-color=4EB94E&button-stroke=245d24",
    ];
    const selectedPlayerTheme = playerThemes[(playerSlot || 0) - 1];
    const isHost = playerSlot == 1;
    const isPlayingMode = gameState?.gameMode === "playing";

    const postImageMsg = async (msg: SimMultiplayer.ImageMessage) => {
        const { image, palette } = msg;
        const { data } = image;

        await gameClient.sendScreenUpdateAsync(data, palette);
    };

    const postInputMsg = async (msg: SimMultiplayer.InputMessage) => {
        const { button, state } = msg;
        await gameClient.sendInputAsync(button, state);
    };

    const setSimStopped = async () => {
        pxt.runner
            .currentDriver()
            ?.resume(pxsim.SimulatorDebuggerCommand.Pause);
    };

    const setSimResumed = async () => {
        pxt.runner
            .currentDriver()
            ?.resume(pxsim.SimulatorDebuggerCommand.Resume);
    };

    useEffect(() => {
        const msgHandler = (
            msg: MessageEvent<
                SimMultiplayer.Message | pxsim.SimulatorStateMessage
            >
        ) => {
            const { data } = msg;
            const { type } = data;

            switch (type) {
                case "status":
                    // Once the simulator is ready, if this isn't the host, send the initial screen
                    const { state: simState } = data;
                    if (simState === "running" && uiMode === "join") {
                        const { image, palette } =
                            gameClient.getCurrentScreen();
                        if (image) {
                            pxt.runner.postSimMessage({
                                type: "multiplayer",
                                content: "Image",
                                image: {
                                    data: image,
                                },
                                palette,
                            } as SimMultiplayer.ImageMessage);
                        }
                    }
                    return;
                case "multiplayer":
                    const { origin, content } = data;
                    if (origin === "client" && content === "Button") {
                        postInputMsg(data);
                    } else if (origin === "server" && content === "Image") {
                        postImageMsg(data);
                    }
                    return;
            }
        };

        window.addEventListener("message", msgHandler);
        return () => window.removeEventListener("message", msgHandler);
    }, [uiMode]);

    const getOpts = () => {
        const opts: pxt.runner.SimulateOptions = {
            embedId: "multiplayer-sim",
            additionalQueryParameters: selectedPlayerTheme,
            single: true,
            fullScreen: true,
            /** Enabling debug mode so that we can stop at breakpoints as a 'global pause' **/
            debug: true,
            mute: state.muted,
        };

        if (isHost) {
            opts.id = gameId;
            opts.mpRole = "server";
        } else {
            opts.code = "multiplayer.init()";
            opts.mpRole = "client";
        }

        return opts;
    };

    const compileSimCode = async () => {
        builtSimJsInfo = pxt.runner.buildSimJsInfo(getOpts());
        return await builtSimJsInfo;
    };

    const preloadSim = async () => {
        pxt.runner.preloadSim(simContainerRef.current!, getOpts());
    };

    const runSimulator = async () => {
        const simOpts = getOpts();
        if (builtSimJsInfo) {
            simOpts.builtJsInfo = await builtSimJsInfo;
        }

        builtSimJsInfo = pxt.runner.simulateAsync(
            simContainerRef.current!,
            simOpts
        );

        await builtSimJsInfo;
    };

    useEffect(() => {
        if (gameState?.gameMode === "playing") {
            runSimulator();
        }
    }, [gameState]);

    useEffect(() => {
        const codeReadyToCompile =
            playerSlot! > 1 || (playerSlot == 1 && gameId);
        if (codeReadyToCompile && gameState?.gameMode !== "playing") {
            preloadSim().then(compileSimCode);
        }
        if (!playerSlot) {
            builtSimJsInfo = undefined;
        }
    }, [playerSlot, gameId]);

    return (
        <div
            id="sim-container"
            ref={simContainerRef}
            className={`tw-h-[calc(100vh-16rem)] tw-w-[calc(100vw-6rem)] ${
                !isPlayingMode ? "tw-invisible" : ""
            }`}
        />
    );
}
