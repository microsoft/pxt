import css from "./styling/ArcadeSimulator.module.scss";
import { useContext, useEffect, useRef } from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim";
import * as collabClient from "@/services/collabClient";
import { AppStateContext } from "@/state/Context";
import { simDriver, preloadSim, simulateAsync, buildSimJsInfo, RunOptions } from "@/services/simHost";
import { initialNoneNetState } from "@/state/state";
import { setPlatoExtInfo } from "@/transforms";

let builtSimJsInfo: Promise<pxtc.BuiltSimJsInfo | undefined> | undefined;

export function ArcadeSimulator() {
    const { state } = useContext(AppStateContext);
    const { netState } = state;
    const gamePaused = false;
    const { clientRole } = netState ?? initialNoneNetState();
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
                    setPlatoExtInfo(version)
                    break;
                }
                default: {
                    pxt.warn(`Unknown PlayTogether extension message type: ${msg.type}`);
                    break;
                }
            }
        };

        const msgHandler = (
            msg: MessageEvent<
                pxsim.SimulatorStateMessage | pxsim.SimulatorTopLevelCodeFinishedMessage | pxsim.SimulatorControlMessage
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
    }, []);

    const getOpts: () => RunOptions = () => {
        let opts: RunOptions;
        opts = {
            shareCode,
            clientRole,
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

// Copied from eanders-ms/arcade-plato/protocol.ts
// Keep them in sync
namespace PlayTogether {
    export namespace _Protocol {

        /**
         * Client --> Host
         * Notify host that the client is a PlayTogether client.
         */
        export interface ClientInitMessage {
            type: "client-init";
            payload: {
                version: number;
            };
        }

        /**
         * Host --> Client
         * Communicate game config and other information to the client.
         */
        export interface HostInitMessage {
            type: "host-init";
            payload: {
                playerId: string; // ID of the local player
                isHost: boolean; // true if the local player is the session host
            };
        }

        /**
         * Host --> Client
         * Notify client that a player is joining the game.
         */
        export interface PlayerJoinedMessage {
            type: "player-joined";
            payload: {
                playerId: string;
                playerName: string;
                //playerIcon: Buffer;
            };
        }

        /**
         * Host --> Client
         * Notify client that a player is leaving the game.
         */
        export interface PlayerLeftMessage {
            type: "player-left";
            payload: {
                playerId: string;
            };
        }

        export type Message = ClientInitMessage | HostInitMessage | PlayerJoinedMessage | PlayerLeftMessage;
    }
}
