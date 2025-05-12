import css from "./styling/ArcadeSimulator.module.scss";
import { useContext, useEffect, useRef } from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim";
import * as collabClient from "@/services/collabClient";
import { AppStateContext } from "@/state/Context";
import { simDriver, preloadSim, simulateAsync, buildSimJsInfo, RunOptions } from "@/services/simHost";
import { initialNetState } from "@/state/state";
import { setPlatoExtInfo, clearPlayerCurrentGames } from "@/transforms";
import { PlayTogether, CHANNEL_ID } from "@/protocol";

let builtSimJsInfo: Promise<pxtc.BuiltSimJsInfo | undefined> | undefined;

export function ArcadeSimulator() {
    const { state } = useContext(AppStateContext);
    const { netState } = state;
    const gamePaused = false;
    const { clientRole, clientId } = netState ?? initialNetState("none");
    const simContainerRef = useRef<HTMLDivElement>(null);
    const sessionState = useSyncExternalStore(
        collabClient.sessionStore.subscribe,
        collabClient.sessionStore.getSnapshot
    );
    const { shareCode } = sessionState;

    useEffect(() => {
        const handlePlayTogetherMessage = (msg: PlayTogether._Protocol.Message) => {
            switch (msg.type) {
                case "client-init": {
                    const { version } = msg.payload;
                    setPlatoExtInfo(version);
                    const initMsg: PlayTogether._Protocol.HostInitMessage = {
                        type: "host-init",
                        payload: {
                            playerId: clientId || "",
                            isHost: clientRole === "host",
                        },
                    };
                    simDriver()?.postMessage({
                        type: "messagepacket",
                        channel: CHANNEL_ID,
                        data: new TextEncoder().encode(JSON.stringify(initMsg)),
                        broadcast: true,
                    } satisfies pxsim.SimulatorControlMessage as any)
                    break;
                }
                default: {
                    pxt.warn(`Unknown PlayTogether message: ${msg.type}`);
                    break;
                }
            }
        }

        const msgHandler = (
            msg: MessageEvent<
                pxsim.SimulatorStateMessage | pxsim.SimulatorTopLevelCodeFinishedMessage |
                pxsim.SimulatorControlMessage | pxsim.SimulatorCommandMessage
            >
        ) => {
            const { data } = msg;
            const { type } = data;

            switch (type) {
                case "status": {
                    return;
                }
                case "toplevelcodefinished": {
                    return;
                }
                case "simulator": {
                    clearPlayerCurrentGames();
                    break;
                }
                case "messagepacket": {
                    const { channel } = data;
                    if (channel !== "arcade-plato-ext") return;
                    const { data: buf } = data;
                    let zdata = new TextDecoder().decode(new Uint8Array(buf))
                    const zmsg = JSON.parse(zdata) as PlayTogether._Protocol.Message;
                    handlePlayTogetherMessage(zmsg);
                    return;
                }
            }
        };

        window.addEventListener("message", msgHandler);
        return () => window.removeEventListener("message", msgHandler);
    }, [clientId, clientRole]);

    const getOpts: () => RunOptions = () => {
        let opts: RunOptions;
        opts = {
            shareCode,
            clientRole,
            clientId,
        };
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
        if (shareCode && simContainerRef.current) {
            preloadSim(simContainerRef.current, getOpts());
        }
    }, [clientRole, shareCode]);

    useEffect(() => {
        if (shareCode) {
            setPlatoExtInfo(0);
            clearPlayerCurrentGames();
            compileSimCode().then(() => {
                runSimulator();
            }).catch((e) => {
                console.error("Error running simulator:", e);
            });
        }
    }, [shareCode]);

    useEffect(() => {
        return () => {
            builtSimJsInfo = undefined;
        };
    });

    return (
        <div
            id="sim-container"
            className={css["sim-container"]}
            ref={simContainerRef}
            style={{
                filter: gamePaused ? "grayscale(70%) blur(1px)" : "none",
                transition: "filter .25s",
            }}
        />
    );
}
