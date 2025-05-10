import { useContext, useEffect, useRef } from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim";
import * as collabClient from "@/services/collabClient";
import { AppStateContext } from "@/state/Context";
import "./styling/ArcadeSimulator.scss";
import { simDriver, preloadSim, simulateAsync, buildSimJsInfo, RunOptions } from "@/services/simHost";
import { initialNoneNetState } from "@/state/state";

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
        const msgHandler = (
            msg: MessageEvent<
                pxsim.SimulatorStateMessage | pxsim.SimulatorTopLevelCodeFinishedMessage
            >
        ) => {
            const { data } = msg;
            const { type } = data;

            switch (type) {
                case "status":
                    return;
                case "toplevelcodefinished": {
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
            ref={simContainerRef}
            style={{
                filter: gamePaused ? "grayscale(70%) blur(1px)" : "none",
                transition: "filter .25s",
            }}
        />
    );
}
