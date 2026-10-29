/// <reference path="../localtypings/pxtparts.d.ts"/>
/// <reference path="../localtypings/pxtarget.d.ts"/>

namespace pxsim {
    export function print(delay: number = 0) {
        function p() {
            try {
                window.print();
            }
            catch (e) {
                // oops
            }
        }

        if (delay)
            setTimeout(p, delay);
        else p();
    }

    export namespace Embed {
        export let frameid: string;
        export function start() {
            window.addEventListener("message", receiveMessage, false);
            frameid = window.location.hash.slice(1)
            initServiceWorker();
            Runtime.postMessage(<SimulatorReadyMessage>{ type: 'ready', frameid: frameid });
        }

        function receiveMessage(event: MessageEvent) {
            let origin = event.origin; // || (<any>event).originalEvent.origin;
            // TODO: test origins

            let data: SimulatorMessage = event.data || {};
            let type = data.type;
            if (!type) return;
            switch (type) {
                case "run": run(<SimulatorRunMessage>data); break;
                case "instructions": pxsim.instructions.renderInstructions(<SimulatorInstructionsMessage>data); break;
                case "stop": stop(); break;
                case "mute": mute((<SimulatorMuteMessage>data).mute); break;
                case "stopsound": stopSound(); break;
                case "print": print(); break;
                case 'recorder': recorder(<SimulatorRecorderMessage>data); break;
                case "screenshot": Runtime.postScreenshotAsync(<SimulatorScreenshotMessage>data); break;
                case "custom":
                    if (handleCustomMessage)
                        handleCustomMessage((<SimulatorCustomMessage>data));
                    break;
                case 'pxteditor':
                    break; //handled elsewhere
                case 'debugger':
                    if (runtime)
                        runtime.handleDebuggerMsg(data as DebuggerMessage);
                    break;
                case 'simulator':
                    let simData = data as SimulatorCommandMessage;
                    switch (simData.command) {
                        case "focus":
                            tickEvent("simulator.focus", { timestamp: simData.timestamp });
                            break;
                        case "blur":
                            tickEvent("simulator.blur", { timestamp: simData.timestamp });
                            break;
                    }
                default: queue(data); break;
            }
        }

        // TODO remove this; this should be using Runtime.runtime which gets
        // set correctly depending on which runtime is currently running
        let runtime: pxsim.Runtime;

        export function stop() {
            if (runtime) {
                runtime.kill();
                if (runtime.board)
                    runtime.board.kill();
                if (runtime.boardView)
                    runtime.boardView.kill();
            }
        }

        export function run(msg: SimulatorRunMessage) {
            stop();

            if (msg.mute)
                mute(msg.mute);
            if (msg.localizedStrings)
                pxsim.localization.setLocalizedStrings(msg.localizedStrings);

            const rt = new Runtime(msg);
            runtime = rt;
            rt.board.initAsync(msg)
                .then(() => rt === runtime && !rt.dead && rt.boardView ? rt.boardView.initAsync(msg) : undefined)
                .then(() => {
                    if (rt === runtime) {
                        rt.run((v) => {
                            pxsim.dumpLivePointers();
                            Runtime.postMessage({ type: "toplevelcodefinished" });
                        });
                    }
                    // else: a new runtime was started while this one was still initializing.
                    // This runtime has already been stopped by the beginning of this function.
                });
        }

        function mute(mute: boolean) {
            audiohost.audio().mute(mute);
        }

        function stopSound() {
            audiohost.audio().stopAll();
        }

        function queue(msg: SimulatorMessage) {
            if (!runtime || runtime.dead) {
                return;
            }
            runtime.board.receiveMessage(msg);
        }

        function recorder(rec: SimulatorRecorderMessage) {
            if (!runtime) return;
            switch (rec.action) {
                case "start":
                    runtime.startRecording(rec.width);
                    break;
                case "stop":
                    runtime.stopRecording();
                    break;
            }
        }
    }

    /**
     * Log an event to the parent editor (allowSimTelemetry must be enabled in target)
     * @param id The id of the event
     * @param data Any custom values associated with this event
     */
    export function tickEvent(id: string, data?: Map<string | number>) {
        postMessageToEditor({
            type: "pxtsim",
            action: "event",
            tick: id,
            data
        });
    }

    /**
     * Log an error to the parent editor (allowSimTelemetry must be enabled in target)
     * @param cat The category of the error
     * @param msg The error message
     * @param data Any custom values associated with this event
     */
    export function reportError(cat: string, msg: string, data?: Map<string>) {
        postMessageToEditor({
            type: "pxtsim",
            action: "event",
            tick: "error",
            category: cat,
            message: msg,
            data
        });
    }

    function postMessageToEditor(message: any) {
        if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
            window.parent.postMessage(message, "*");
        }
    }

    function initServiceWorker() {
        // pxsim is included in both the webapp and the simulator so we need to check if the ---simulator is
        // present in the window location
        if ("serviceWorker" in navigator && window.location.href.indexOf("---simulator") !== -1 && !U.isLocalHost()) {
            // We don't have access to the webconfig in pxtsim so we need to extract the ref from the URL
            const pathname = window.location.pathname;
            const ref = pathname.substring(1, pathname.indexOf("---"));

            // Only reload if there is already a service worker installed
            if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.addEventListener("message", ev => {
                    const message = ev.data as pxt.ServiceWorkerEvent;

                    // We need to check the ref of the activated service worker so that we don't reload if you have
                    // index.html and beta open at the same time
                    if (message && message.type === "serviceworker" && message.state === "activated" && message.ref === ref) {
                        reload();
                    }
                });
            }

            const serviceWorkerUrl = window.location.href.replace(/---simulator.*$/, "---simserviceworker");
            navigator.serviceWorker.register(serviceWorkerUrl).then(function (registration) {
                pxsim.log("Simulator ServiceWorker registration successful with scope: ", registration.scope);
            }, function (err) {
                pxsim.log("Simulator ServiceWorker registration failed: ", err);
            });
        }
    }

    export function reload() {
        // Continuously send message just in case the editor isn't ready to handle it yet
        setInterval(() => {
            Runtime.postMessage({ type: "simulator", command: "reload" } as SimulatorCommandMessage)
        }, 3000)
    }
}

pxsim.util.injectPolyphils();
if (typeof window !== 'undefined') {
    window.addEventListener('load', function (ev) {
        pxsim.Embed.start();
    });
}
