import { useContext, useEffect, useRef } from "react";
import { AppStateContext } from "../state/AppStateContext";
import { SimMultiplayer } from "../types";
import { sendSimMessage } from "../services/gameClient";
import { classList } from "react-common/components/util";

export default function Render() {
    const { state } = useContext(AppStateContext);
    const { gameId, playerSlot } = state;
    const simIframeRef = useRef<HTMLIFrameElement>(null);
    const simContainerRef = useRef<HTMLDivElement>(null);

    const playerThemes = [
        "background-color=ED3636&button-stroke=8d2525&button-fill=0b0b0b",
        "background-color=4E4EE9&button-stroke=3333a1&button-fill=0b0b0b",
        "background-color=FFDF1A&button-stroke=c1a916&button-fill=0b0b0b",
        "background-color=4EB94E&button-stroke=245d24&button-fill=0b0b0b",
    ];
    const selectedPlayerTheme = playerThemes[(playerSlot || 0) - 1];
    const isHost = playerSlot == 1;

    const queryParameters = [
        "single=1",
        "nofooter=1",
        "fullscreen=1",
        selectedPlayerTheme &&
            `simParams=${encodeURIComponent(selectedPlayerTheme)}`,
    ].filter(el => !!el);

    if (isHost) {
        queryParameters.push(
            `id=${gameId}`,
            "mp=server"
        );
    } else {
        queryParameters.push(
            `code=${encodeURIComponent("multiplayer.init()")}`,
            "mp=client"
        );
    }

    const postImageMsg = (msg: SimMultiplayer.ImageMessage) => {
        const { image } = msg;
        // JSON converts uint8array -> {"1": 160, "10": 2, ...}, serialize as hex string.
        image.data = (image.data as Uint8Array).reduce(
            (acc, byte) => acc + byte.toString(16).padStart(2, "0"),
            ""
        );
        sendSimMessage({
            type: "screen",
            data: image,
        });
    };

    const postInputMsg = (msg: SimMultiplayer.InputMessage) => {
        const { button, state } = msg;
        sendSimMessage({
            type: "input",
            data: {
                button,
                state,
            },
        });
    };

    const msgHandler = (msg: MessageEvent<SimMultiplayer.Message>) => {
        const { data } = msg;
        const { broadcast, origin, content } = data;

        if (!broadcast) return;

        if (origin === "client" && content === "Button") {
            postInputMsg(data);
        } else if (origin === "server" && content === "Image") {
            postImageMsg(data);
        }
    };

    useEffect(() => {
        window.addEventListener("message", msgHandler);
        return () => window.removeEventListener("message", msgHandler);
    }, []);

    const fullUrl = `${pxt.webConfig.runUrl}?${queryParameters.join("&")}`;

    // const createSim = () => {
    //     var sims = document.createElement("div");
    //     sims.className = "sim-embed";
    //     var simframeWrapper = document.createElement("div");
    //     simframeWrapper.className = "simframe ui embed";
    //     var emptySim = document.createElement("iframe");
    //     emptySim.className = "sim-embed";
    //     /* eslint-disable @microsoft/sdl/react-iframe-missing-sandbox */
    //     emptySim.setAttribute("sandbox", "allow-popups allow-forms allow-scripts allow-same-origin");
    //     /* eslint-enable @microsoft/sdl/react-iframe-missing-sandbox */
    //     emptySim.frameBorder = "0";
    //     emptySim.src = pxt.webConfig.simUrl;
    //     emptySim.className = "grayscale";
    //     // unused, satisfying pxtsim/simdriver.ts#setFrameState. Maybe Add some animation here?
    //     var icon = document.createElement("div");
    //     var loader = document.createElement("div");
    //     loader.className = "loader";
    //     loader.appendChild(document.createElement("div"));
    //     loader.appendChild(document.createElement("div"));

    //     simframeWrapper.appendChild(emptySim);
    //     simframeWrapper.appendChild(icon);
    //     simframeWrapper.appendChild(loader);

    //     sims.appendChild(simframeWrapper);
    //     return sims;
    // }
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
        } else {
            opts.code = "multiplayer.init()";
        }

        const builtJsInfo = await pxt.runner.simulateAsync(simContainerRef.current!, opts);
        console.log(`BUILT for ${builtJsInfo.targetVersion}`);
        const sim: HTMLIFrameElement = simContainerRef.current!.firstChild as HTMLIFrameElement;
        sim?.classList.add(
            "tw-h-[calc(100vh-26rem)]",
            "tw-w-screen",
        )
    }
    runSimulator();
    return (
        /* eslint-disable @microsoft/sdl/react-iframe-missing-sandbox */
        <div id="sim-container" ref={simContainerRef} className="tw-grow tw-mt-5">
            <iframe
                id="sim-iframe"
                ref={simIframeRef}
                src={fullUrl}
                allowFullScreen={true}
                // TODO:  this calc is weird, needs cleaning.
                className="tw-h-[calc(100vh-26rem)] tw-w-screen"
                sandbox="allow-popups allow-forms allow-scripts allow-same-origin"
                title={lf("Arcade Game Simulator")}
            />
        </div>
        /* eslint-enable @microsoft/sdl/react-iframe-missing-sandbox */
    );
}
