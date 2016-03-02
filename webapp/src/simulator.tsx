import * as React from "react";
import * as ReactDOM from "react-dom";
import * as sui from "./sui"

export interface ISimulatorProps {}

export class Simulator extends React.Component<ISimulatorProps, {}> {
    componentDidMount() {
        let frame = ReactDOM.findDOMNode(this);
        frame.addEventListener('message', (ev : MessageEvent) => {
            console.log('simulator: ' + JSON.stringify(ev.data));
        }, false);
    }
    
    static postMessage(msg : any) {
        let frame = document.getElementById('simframe') as HTMLIFrameElement;
        // TODO target.
        if (frame) frame.contentWindow.postMessage(msg, "*");
    }
    
    static run(target:string, js:string, enums: any) {
        let msg = {
            kind:'run',
            target: target,
            enums: enums,
            code: js
        }
        Simulator.postMessage(msg)
        /*
        r.errorHandler = (e: any) => {
            core.errorNotification(e.message)
            console.error("Simulator error", e.stack)
        } 
        r.stateChanged = () => { this.forceUpdate() }
        */
    }

    render() {
        return <div className='simulator'> 
            <iframe id="simframe" sandbox="allow-same-origin allow-scripts" src="./simulator.html" />
            </div>
    }
}