
namespace ks.rt {
    export interface SimulatorMessage {
        type: string;
    }

    export interface SimulatorRunMessage extends SimulatorMessage {
        id?: string;
        frameCounter?: number;
        options?: any;
        
        code: string;
    }

    export interface SimulatorReadyMessage extends SimulatorMessage {
        frameid: string;
    }
    
    export interface SimulatorStateMessage extends SimulatorMessage {
        frameid?: string;
        runtimeid?:string;
        state:string;
    }
    
    export interface SimulatorEventBusMessage extends SimulatorMessage {
        id: number;
        eventid: number;
        value?: number;
    }
    export interface SimulatorSerialMessage extends SimulatorMessage {
        id: string;
        data: string;
    }
    export interface SimulatorRadioPacketMessage extends SimulatorMessage {
        data: number[];
        rssi?: number;
    }
    
    export module Embed {
        export function start() {
            console.log('listening for simulator commands')
            window.addEventListener("message", receiveMessage, false);
            let frameid = window.location.hash.slice(1)
            Runtime.postMessage(<SimulatorReadyMessage>{ type:'ready', frameid: frameid});     
        }

        function receiveMessage(event: MessageEvent) {
            let origin = event.origin; // || (<any>event).originalEvent.origin;
            // TODO: test origins

            let data: SimulatorMessage = event.data || {};
            let type = data.type || '';
            if (!type) return;
            switch (type || '') {
                case 'run': run(<SimulatorRunMessage>data);break;
                case 'stop': stop(); break;
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
        var runtime : ks.rt.Runtime;
                
        export function stop() {
            if (runtime) {
                console.log('stopping simulator...')
                runtime.kill();
            }            
        }
        
        export function run(msg: SimulatorRunMessage) {
            stop();
            console.log(`starting ${msg.id}`);
            runtime = new Runtime(msg.code);
            runtime.id = msg.id;
            runtime.board.initAsync(msg)
                .done(() => {
                    runtime.run((v) => {
                        console.log("DONE")
                        ks.rt.dumpLivePointers();
                    })                   
                })            
        }
        
        function queue(msg : SimulatorMessage) {
            if (!runtime || runtime.dead) {
                return;
            }            
            runtime.board.receiveMessage(msg);
        }
                           
    }
}

if (typeof window !== 'undefined') {
            window.addEventListener('load', function(ev) {
            ks.rt.Embed.start();
        });
}
