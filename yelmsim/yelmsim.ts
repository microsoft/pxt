
namespace yelm.rt {
    export interface SimulatorMessage {
        kind: string;
    }

    export interface SimulatorRunMessage extends SimulatorMessage {
        code: string;
        target: string;
        enums: {
            [index:string] : number;
        }
    }
    
    export interface SimulatorStateMessage extends SimulatorMessage {
        state:string;
    }
    
    export module Embed {
        export function start() {
            console.log('listening for simulator commands')
            window.addEventListener("message", receiveMessage, false);       
            Runtime.postMessage({ kind:'status', state: 'ready'});     
        }

        function receiveMessage(event: MessageEvent) {
            console.log('received ' + JSON.stringify(event.data, null, 2))
            
            let origin = event.origin; // || (<any>event).originalEvent.origin;
            // TODO: test origins

            let data: SimulatorMessage = event.data || {};
            let kind = data.kind || '';
            if (!kind) return;
            switch (kind || '') {
                case 'run': run(<SimulatorRunMessage>data);break;
                case 'stop': stop(); break;
                default: queue(data); break;
            }
        }
                
        var runtime : yelm.rt.Runtime;        
        export function stop() {
            if (runtime) {
                console.log('stopping preview runtime...')
                runtime.kill();
            }            
        }
        
        export function run(msg: SimulatorRunMessage) {
            stop();
            // TODO test data
            console.log('starting ' + msg.target);
            runtime = new Runtime(msg.code, msg.target, msg.enums);
            switch(msg.target) {
                case 'microbit': initMicrobit(); break;
                case 'minecraft': initMinecraft(); break;
                default: console.error('unknown target');
            }
            
            runtime.run((v) => {
                console.log("DONE")
                yelm.rt.dumpLivePointers();
            })
        }
        
        function queue(msg : SimulatorMessage) {
            if (!runtime || runtime.dead) {
                console.log('runtime not started or dead');
                return;
            }
            
            runtime.board.receiveMessage(msg);
        }
                
        function initMicrobit() {
            console.log('setting up microbit simulator')
            let view = new yelm.rt.micro_bit.MicrobitBoardSvg({
                theme: yelm.rt.micro_bit.randomTheme(),
                runtime: runtime
            })
            document.body.innerHTML = ''; // clear children
            document.body.appendChild(view.element);            
        }
        
        function initMinecraft() {
            console.log('setting up minecraft simulator');
            // TODO
        }
    }
}

if (typeof window !== 'undefined') {
            window.addEventListener('load', function(ev) {
            yelm.rt.Embed.start();
        });

}