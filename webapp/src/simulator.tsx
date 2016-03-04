/// <reference path="../../built/yelmsim.d.ts" />
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as sui from "./sui"

export interface ISimulatorProps { }

export class Simulator extends React.Component<ISimulatorProps, {}> {
    static nextFrameId : number = 0;
    static themes = ["blue", "red", "green", "yellow"];
    
    componentDidMount() {
        window.addEventListener('message', (ev: MessageEvent) => {
            let msg = ev.data;
            switch(msg.type || '') {
                case 'status':
                     switch(msg.state || '') {
                         case 'ready':
                            Simulator.startFrame(ev.source.frameElement as HTMLIFrameElement);
                            break;                           
                     }
                     break;
                case 'serial': break; //handled elsewhere
                default:
                    if (msg.type == 'radiopacket') {
                        // assign rssi noisy?
                        (msg as yelm.rt.SimulatorRadioPacketMessage).rssi = 10;
                    }
                    Simulator.postMessage(ev.data, ev.source);
                    break;
            }
        }, false);
        
    }
     
    static postMessage(msg: yelm.rt.SimulatorMessage, source?: Window) {
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
        frame.className = 'simframe';
        frame.setAttribute('sandbox', 'allow-same-origin allow-scripts');
        let cdn = (window as any).appCdnRoot
        frame.src = cdn + 'simulator.html';
        frame.frameBorder = "0";
        return frame;
    }
    
    static startFrame(frame : HTMLIFrameElement) {
        let msg = yelm.U.clone(Simulator.currentRuntime) as yelm.rt.SimulatorRunMessage;
        msg.id = 'sim' + Simulator.nextFrameId++;
        msg.theme = Simulator.themes[Simulator.nextFrameId % Simulator.themes.length];
        
        frame.dataset["simid"] = msg.id;
        frame.dataset["simtheme"] = msg.theme;
        frame.contentWindow.postMessage(msg, "*");        
    }

    static currentRuntime : yelm.rt.SimulatorRunMessage;
    static stop() {
        Simulator.postMessage({ type: 'stop' });
    }
    static run(target: string, js: string, enums: any) {
        // store information
        Simulator.currentRuntime = {
            type: 'run',
            target: target,
            enums: enums,
            code: js
        }
        
        let simulators = $('#simulators');
        // drop extras frames
        simulators.find('iframe:gt(0)').remove();
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