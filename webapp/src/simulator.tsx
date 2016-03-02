import * as React from "react";
import * as ReactDOM from "react-dom";
import * as sui from "./sui"

export interface ISimulatorProps { }

export class Simulator extends React.Component<ISimulatorProps, {}> {
    componentDidMount() {
        window.addEventListener('message', (ev: MessageEvent) => {
            let msg = ev.data;
            switch(msg.kind || '') {
                case 'status':
                     switch(msg.state || '') {
                         case 'ready':
                            Simulator.startFrame(ev.source.frameElement as HTMLIFrameElement);
                            break;                           
                     }
                     break;
                default:
                    Simulator.postMessage(ev.data, ev.source);
                    break;
            }
        }, false);
        
    }
     
    static postMessage(msg: any, source?: Window) {
        // dispatch to all iframe besides self
        let frames = $('#simulators iframe');
        if (source && msg.kind === 'eventbus' && frames.length < 2) {
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
        frame.src = './simulator.html';
        frame.frameBorder = "0";
        return frame;
    }
    
    static startFrame(frame : HTMLIFrameElement) {
        frame.contentWindow.postMessage(Simulator.currentRuntime, "*");        
    }

    static currentRuntime : any;
    static run(target: string, js: string, enums: any) {
        // store information
        Simulator.currentRuntime = {
            kind: 'run',
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