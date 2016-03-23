/// <reference path="../../built/kindsim.d.ts" />
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as sui from "./sui"

export interface ISimulatorProps { }

export class Simulator extends React.Component<ISimulatorProps, {}> {
    static nextFrameId: number = 0;
    static themes = ["blue", "red", "green", "yellow"];

    private handleDebuggerMessage(msg: ks.rt.DebuggerMessage) {
        console.log("DBG-MSG", msg.subtype, msg)
        switch (msg.subtype) {
            case "breakpoint":
                let brk = msg as ks.rt.DebuggerBreakpointMessage
                break;
        }
    }
    
    componentDidMount() {
        window.addEventListener('message', (ev: MessageEvent) => {
            let msg = ev.data;
            switch (msg.type || '') {
                case 'ready':
                    let frameid = (msg as ks.rt.SimulatorReadyMessage).frameid;
                    let frame = $('#' + frameid)[0] as HTMLIFrameElement;
                    if (frame) Simulator.startFrame(frame);
                    break;
                case 'serial': break; //handled elsewhere
                case 'debugger': this.handleDebuggerMessage(msg); break;
                default:
                    if (msg.type == 'radiopacket') {
                        // assign rssi noisy?
                        (msg as ks.rt.SimulatorRadioPacketMessage).rssi = 10;
                    }
                    Simulator.postMessage(ev.data, ev.source);
                    break;
            }
        }, false);

    }

    static postDebuggerMessage(subtype: string, data: any = {}) {
        let msg: ks.rt.DebuggerMessage = JSON.parse(JSON.stringify(data))
        msg.type = "debugger"
        msg.subtype = subtype
        Simulator.postMessage(msg)
    }

    static postMessage(msg: ks.rt.SimulatorMessage, source?: Window) {
        // dispatch to all iframe besides self
        let frames = $('#simulators iframe');
        if (source && (msg.type === 'eventbus' || msg.type == 'radiopacket') && frames.length < 2) {
            let frame = Simulator.createFrame()
            $('#simulators').append(frame);
            frames = $('#simulators iframe');
        }
        frames.each((index, el) => {
            let frame = el as HTMLIFrameElement
            if (source && frame.contentWindow == source) return;

            frame.contentWindow.postMessage(msg, "*");
        })
    }

    static createFrame(): HTMLIFrameElement {
        let frame = document.createElement('iframe') as HTMLIFrameElement;
        frame.id = ks.Util.guidGen()
        frame.className = 'simframe';
        frame.setAttribute('sandbox', 'allow-same-origin allow-scripts');
        let cdn = (window as any).simCdnRoot
        frame.src = cdn + 'simulator.html#' + frame.id;
        frame.frameBorder = "0";
        return frame;
    }

    static startFrame(frame: HTMLIFrameElement) {
        let msg = ks.U.clone(Simulator.currentRuntime) as ks.rt.SimulatorRunMessage;
        let mc = '';
        let m = /player=([A-Za-z0-9]+)/i.exec(window.location.href); if (m) mc = m[1];
        msg.options = {
            theme: Simulator.themes[Simulator.nextFrameId++ % Simulator.themes.length],
            player: mc
        };
        msg.id = `${msg.options.theme}-${ks.Util.guidGen()}`;
        frame.contentWindow.postMessage(msg, "*");
        frame.classList.remove("grayscale")
    }

    static currentRuntime: ks.rt.SimulatorRunMessage;
    static stop(unload = false) {
        Simulator.postMessage({ type: 'stop' });
        if (unload) Simulator.unload();
        let simulators = $('#simulators');
        simulators.find('iframe').addClass("grayscale")
    }
    static unload() {
        $('#simulators').html('');
    }
    static run(js: string, enums: any) {
        // store information
        Simulator.currentRuntime = {
            type: 'run',
            enums: enums,
            code: js
        }

        let simulators = $('#simulators');
        // drop extras frames
        simulators.find('iframe').slice(1).remove();
        let frame = simulators.find('iframe')[0] as HTMLIFrameElement;
        // lazy allocate iframe
        if (!frame) {
            frame = Simulator.createFrame();
            simulators.append(frame);
            // delay started
        } else
            Simulator.startFrame(frame);
    }

    render() {
        return <div id="simulators" className='simulator'>
        </div>
    }
}