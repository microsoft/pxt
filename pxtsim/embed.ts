/// <reference path="../localtypings/pxtparts.d.ts"/>

namespace pxsim {
    export interface SimulatorMessage {
        type: string;
    }

    export interface SimulatorRunMessage extends SimulatorMessage {
        type: "run";
        id?: string;
        boardDefinition?: BoardDefinition;
        frameCounter?: number;
        options?: any;
        parts?: string[];
        partDefinitions?: Map<PartDefinition>
        fnArgs?: any;
        code: string;
        mute?: boolean;
    }

    export interface SimulatorMuteMessage extends SimulatorMessage {
        type: "mute";
        mute: boolean;
    }

    export interface SimulatorDocMessage extends SimulatorMessage {
        docType?: string;
        src?: string;
        localToken?: string;
    }

    export interface SimulatorFileLoadedMessage extends SimulatorMessage {
        name: string;
        locale: string;
        content?: string;
    }

    export interface SimulatorReadyMessage extends SimulatorMessage {
        type: "ready";
        frameid: string;
    }

    export interface SimulatorDocsReadyMessage extends SimulatorMessage {
    }

    export interface SimulatorStateMessage extends SimulatorMessage {
        frameid?: string;
        runtimeid?: string;
        state: string;
    }

    export interface SimulatorEventBusMessage extends SimulatorMessage {
        id: number;
        eventid: number;
        value?: number;
    }
    export interface SimulatorSerialMessage extends SimulatorMessage {
        id: string;
        data: string;
        sim?: boolean;
    }
    export interface SimulatorCommandMessage extends SimulatorMessage {
        type: "simulator",
        command: "modal" | "restart"
        header?: string;
        body?: string;
        copyable?: string;
    }
    export interface SimulatorRadioPacketMessage extends SimulatorMessage {
        rssi: number;
        serial: number;
        time: number;

        payload: SimulatorRadioPacketPayload;
    }

    export interface SimulatorRadioPacketPayload {
        type: number;
        stringData?: string;
        numberData?: number;
    }

    export interface SimulatorCustomMessage extends SimulatorMessage {
        type: "custom";
        content: any;
    }

    export interface SimulatorScreenshotMessage extends SimulatorMessage {
        type: "screenshot";
        data: string;
    }

    export interface TutorialMessage extends SimulatorMessage {
        type: "tutorial";
        tutorial: string;
        subtype: string;
    }

    export interface TutorialStepLoadedMessage extends TutorialMessage {
        subtype: "steploaded";
        data: {[index: string]: number };
        showCategories?: boolean;
        location?: string;
    }

    export interface TutorialStepChangeMessage extends TutorialMessage {
        subtype: "stepchange";
        step: number;
    }

    export namespace Embed {
        export function start() {
            window.addEventListener("message", receiveMessage, false);
            let frameid = window.location.hash.slice(1)
            Runtime.postMessage(<SimulatorReadyMessage>{ type: 'ready', frameid: frameid });
        }

        function receiveMessage(event: MessageEvent) {
            let origin = event.origin; // || (<any>event).originalEvent.origin;
            // TODO: test origins

            let data: SimulatorMessage = event.data || {};
            let type = data.type || '';
            if (!type) return;
            switch (type || '') {
                case 'run': run(<SimulatorRunMessage>data); break;
                case 'stop': stop(); break;
                case 'mute': mute((<SimulatorMuteMessage>data).mute); break;
                case 'custom':
                    if (handleCustomMessage) handleCustomMessage((<SimulatorCustomMessage>data));
                    break;
                case 'pxteditor':
                    break; //handled elsewhere
                case 'debugger':
                    if (runtime) {
                        runtime.handleDebuggerMsg(data as DebuggerMessage);
                    }
                    break;
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

            if (msg.mute) mute(msg.mute);

            runtime = new Runtime(msg.code);
            runtime.id = msg.id;
            runtime.board.initAsync(msg)
                .done(() => {
                    runtime.run((v) => {
                        pxsim.dumpLivePointers();
                    })
                })
        }

        function mute(mute: boolean) {
            AudioContextManager.mute(mute);
        }

        function queue(msg: SimulatorMessage) {
            if (!runtime || runtime.dead) {
                return;
            }
            runtime.board.receiveMessage(msg);
        }

    }
}

pxsim.util.injectPolyphils();
if (typeof window !== 'undefined') {
    window.addEventListener('load', function (ev) {
        pxsim.Embed.start();
    });
}
