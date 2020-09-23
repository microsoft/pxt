/// <reference path="../localtypings/pxtparts.d.ts"/>
/// <reference path="../localtypings/pxtarget.d.ts"/>

namespace pxsim {
    export interface SimulatorRunMessage extends SimulatorMessage {
        type: "run";
        id?: string;
        boardDefinition?: BoardDefinition;
        frameCounter?: number;
        refCountingDebug?: boolean;
        options?: any;
        parts?: string[];
        partDefinitions?: Map<PartDefinition>
        fnArgs?: any;
        code: string;
        mute?: boolean;
        highContrast?: boolean;
        light?: boolean;
        cdnUrl?: string;
        localizedStrings?: Map<string>;
        version?: string;
        clickTrigger?: boolean;
        breakOnStart?: boolean;
        storedState?: Map<any>;
    }

    export interface SimulatorInstructionsMessage extends SimulatorMessage {
        type: "instructions";
        options: pxsim.instructions.RenderPartsOptions;
    }

    export interface SimulatorMuteMessage extends SimulatorMessage {
        type: "mute";
        mute: boolean;
    }

    export interface SimulatorStopSoundMessage extends SimulatorMessage {
        type: "stopsound";
    }

    export interface SimulatorDocMessage extends SimulatorMessage {
        type: "localtoken" | "docfailed";
        docType?: string;
        src?: string;
        localToken?: string;
    }

    export interface SimulatorFileLoadedMessage extends SimulatorMessage {
        type: "fileloaded";
        name: string;
        // localeInfo NOT userLanguage
        locale: string;
        content?: string;
    }

    export interface SimulatorReadyMessage extends SimulatorMessage {
        type: "ready";
        frameid: string;
    }

    export interface SimulatorTopLevelCodeFinishedMessage extends SimulatorMessage {
        type: "toplevelcodefinished";
    }

    export interface SimulatorOpenDocMessage extends SimulatorMessage {
        type: "opendoc";
        url: string;
    }

    export interface SimulatorStateMessage extends SimulatorMessage {
        type: "status";
        frameid?: string;
        runtimeid?: string;
        state: string;
    }
    export interface SimulatorBroadcastMessage extends SimulatorMessage {
        broadcast: boolean;
    }
    export interface SimulatorEventBusMessage extends SimulatorBroadcastMessage {
        type: "eventbus";
        broadcast: true;
        id: number;
        eventid: number;
        value?: number;
    }
    export interface SimulatorSerialMessage extends SimulatorMessage {
        type: "serial";
        id: string;
        data: string;
        sim?: boolean;
        receivedTime?: number;
    }
    export interface SimulatorBulkSerialMessage extends SimulatorMessage {
        type: "bulkserial";
        id: string;
        data: { data: string, time: number }[];
        sim?: boolean;
    }
    export interface SimulatorCommandMessage extends SimulatorMessage {
        type: "simulator",
        command: "modal" | "restart" | "reload" | "setstate" | "focus" | "blur"
        stateKey?: string;
        stateValue?: any;
        header?: string;
        body?: string;
        copyable?: string;
        linkButtonHref?: string;
        linkButtonLabel?: string;
        displayOnceId?: string; // An id for the modal command, if the sim wants the modal to be displayed only once in the session
        modalContext?: string; // Modal context of where to show the modal
        timestamp?: number;
    }
    export interface SimulatorRadioPacketMessage extends SimulatorBroadcastMessage {
        type: "radiopacket";
        broadcast: true;
        rssi: number;
        serial: number;
        time: number;

        payload: SimulatorRadioPacketPayload;
    }
    export interface SimulatorInfraredPacketMessage extends SimulatorBroadcastMessage {
        type: "irpacket";
        broadcast: true;
        packet: Uint8Array; // base64 encoded
    }
    export interface SimulatorBLEPacketMessage extends SimulatorBroadcastMessage {
        type: "blepacket";
        broadcast: true;
        packet: Uint8Array;
    }
    export interface SimulatorI2CMessage extends SimulatorMessage {
        type: "i2c";
        data: Uint8Array;
    }

    export interface SimulatorRadioPacketPayload {
        type: number;
        groupId: number;
        stringData?: string;
        numberData?: number;
    }

    export interface SimulatorCustomMessage extends SimulatorMessage {
        type: "custom";
        content: any;
    }

    export interface SimulatorScreenshotMessage extends SimulatorMessage {
        type: "screenshot";
        data: ImageData;
        delay?: number;
        modalContext?: string;
    }

    export interface SimulatorRecorderMessage extends SimulatorMessage {
        type: "recorder";
        action: "start" | "stop";
        width?: number;
    }

    export interface TutorialMessage extends SimulatorMessage {
        type: "tutorial";
        tutorial: string;
        subtype: string;
    }

    export interface ImportFileMessage extends SimulatorMessage {
        type: "importfile";
        filename: string;
        parts: (string | ArrayBuffer)[];
    }

    export interface TutorialStepInfo {
        fullscreen?: boolean;
        contentMd?: string;
        headerContentMd?: string;
        hintContentMd?: string;
    }

    export interface TutorialLoadedMessage extends TutorialMessage {
        subtype: "loaded";
        showCategories?: boolean;
        stepInfo: TutorialStepInfo[];
        toolboxSubset?: { [index: string]: number };
    }

    export interface TutorialStepChangeMessage extends TutorialMessage {
        subtype: "stepchange";
        step: number;
    }

    export interface TutorialFailedMessage extends TutorialMessage {
        subtype: "error";
        message?: string;
    }

    export interface RenderReadyResponseMessage extends SimulatorMessage {
        source: "makecode",
        type: "renderready"
    }

    export interface RenderBlocksRequestMessage extends SimulatorMessage {
        type: "renderblocks",
        id: string;
        code?: string;
        options?: {
            packageId?: string;
            package?: string;
            snippetMode?: boolean;
        }
    }

    export interface RenderBlocksResponseMessage extends SimulatorMessage {
        source: "makecode",
        type: "renderblocks",
        id: string;
        svg?: string;
        width?: number;
        height?: number;
        css?: string;
        uri?: string;
        error?: string;
    }

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
                case "screenshot": Runtime.postScreenshotAsync(<SimulatorScreenshotMessage>data).done(); break;
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
            }
        }

        export function run(msg: SimulatorRunMessage) {
            stop();

            if (msg.mute)
                mute(msg.mute);
            if (msg.localizedStrings)
                pxsim.localization.setLocalizedStrings(msg.localizedStrings);

            runtime = new Runtime(msg);
            runtime.board.initAsync(msg)
                .done(() => {
                    runtime.run((v) => {
                        pxsim.dumpLivePointers();
                        Runtime.postMessage({ type: "toplevelcodefinished" })
                    });
                });
        }

        function mute(mute: boolean) {
            AudioContextManager.mute(mute);
        }

        function stopSound() {
            AudioContextManager.stopAll();
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
                console.log("Simulator ServiceWorker registration successful with scope: ", registration.scope);
            }, function (err) {
                console.log("Simulator ServiceWorker registration failed: ", err);
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
