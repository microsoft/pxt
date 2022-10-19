import { useContext, useEffect, useRef } from "react";
import { AppStateContext } from "../state/AppStateContext";
import { SimMultiplayer } from "../types";
import { sendInputAsync, sendScreenUpdateAsync } from "../services/gameClient";
// eslint-disable-next-line import/no-unassigned-import
import "./ArcadeSimulator.css";

export default function Render() {
    const { state } = useContext(AppStateContext);
    const { gameId, playerSlot, gameState } = state;
    const simContainerRef = useRef<HTMLDivElement>(null);

    const playerThemes = [
        "background-color=ED3636&button-stroke=8d2525",
        "background-color=4E4EE9&button-stroke=3333a1",
        "background-color=FFDF1A&button-stroke=c1a916",
        "background-color=4EB94E&button-stroke=245d24",
    ];
    const selectedPlayerTheme = playerThemes[(playerSlot || 0) - 1];
    const isHost = playerSlot == 1;

    const postImageMsg = async (msg: SimMultiplayer.ImageMessage) => {
        const { image } = msg;
        const { data } = image;

        await sendScreenUpdateAsync(data);
    };

    const postInputMsg = async (msg: SimMultiplayer.InputMessage) => {
        const { button, state } = msg;
        await sendInputAsync(button, state);
    };

    const msgHandler = (
        msg: MessageEvent<SimMultiplayer.Message | pxsim.SimulatorReadyMessage>
    ) => {
        const { data } = msg;
        const { type } = data;

        switch (type) {
            case "ready":
                if (isHost && gameState?.gameMode !== "playing") {
                    // Sim running at this point, send a pause next breakpoint msg.
                    // Maybe settimeout for ~50ms to allow a frame to go through / get past first screen render?
                    const simDriver = pxt.runner.currentDriver();

                    // TODO: for this to work I believe when need to do set breakpoints, need to set that in in pxtrunner.
                    simDriver?.resume(pxsim.SimulatorDebuggerCommand.Pause);
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

    useEffect(() => {
        window.addEventListener("message", msgHandler);
        return () => window.removeEventListener("message", msgHandler);
    }, []);

    const runSimulator = async () => {
        const opts: pxt.runner.SimulateOptions = {
            additionalQueryParameters: selectedPlayerTheme,
            single: true,
            fullScreen: true,
            /** Enabling debug mode so that we can stop at breakpoints as a 'global pause' **/
            debug: true,
        };
        if (isHost) {
            opts.id = gameId;
            opts.mpRole = "server";
        } else {
            opts.code = "multiplayer.init()";
            opts.mpRole = "client";
        }

        // TODO: do we want to keep an imm cache here for instant reload playing same game?
        const builtJsInfo = await pxt.runner.simulateAsync(
            simContainerRef.current!,
            opts
        );
    };

    useEffect(() => {
        if (gameState?.gameMode === "playing") {
            const simDriver = pxt.runner.currentDriver();
            simDriver?.resume(pxsim.SimulatorDebuggerCommand.Resume);
        }
    }, [gameState]);

    useEffect(() => {
        runSimulator();
    }, [playerSlot, gameId]);

    return (
        <div
            id="sim-container"
            ref={simContainerRef}
            className="tw-h-[calc(100vh-16rem)] tw-w-[calc(100vw-6rem)]"
        />
    );
}
