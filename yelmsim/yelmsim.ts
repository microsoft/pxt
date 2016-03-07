
namespace yelm.rt {
    export interface SimulatorMessage {
        type: string;
    }

    export interface SimulatorRunMessage extends SimulatorMessage {
        id?: string;
        theme?: string;
        
        code: string;
        target: string;
        enums: {
            [index:string] : number;
        }
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
                default: queue(data); break;
            }
        }
                
        var runtime : yelm.rt.Runtime;        
        export function stop() {
            if (runtime) {
                console.log('stopping simulator...')
                runtime.kill();
            }            
        }
        
        export function run(msg: SimulatorRunMessage) {
            stop();
            // TODO test data
            console.log(`starting ${msg.target} ${msg.id}`);
            runtime = new Runtime(msg.code, msg.target, msg.enums);
            runtime.id = msg.id;
            runtime.board.initAsync(msg)
                .done(() => {
                    runtime.run((v) => {
                        console.log("DONE")
                        yelm.rt.dumpLivePointers();
                    })                   
                })            
        }
        
        function queue(msg : SimulatorMessage) {
            if (!runtime || runtime.dead) {
                console.log('runtime not started or dead');
                return;
            }
            
            runtime.board.receiveMessage(msg);
        }
                           
    }
}

if (typeof window !== 'undefined') {
            window.addEventListener('load', function(ev) {
            yelm.rt.Embed.start();
        });
}