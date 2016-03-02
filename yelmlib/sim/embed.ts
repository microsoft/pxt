namespace yelm.rt {
    export interface SimulatorMessage {
        kind: string;
    }

    export interface SimulatorRunMessage extends SimulatorMessage {
        code: string;
        target: string;
        enums: U.Map<number>;
    }
    
    export interface SimulatorStateMessage extends SimulatorMessage {
        state:string;
    }

    export module Embed {
        export function start() {
            console.log('listening for simulator commands')
            window.addEventListener("message", receiveMessage, false);            
        }

        function receiveMessage(event: MessageEvent) {
            console.log('received ' + JSON.stringify(event.data, null, 2))
            
            let origin = event.origin; // || (<any>event).originalEvent.origin;
            // TODO: test origins

            let data: SimulatorMessage = event.data || {};
            let kind = data.kind || '';
            switch (kind || '') {
                case 'run': run(<SimulatorRunMessage>data);
                default: console.error('unknown message');
            }
        }
        
        function postMessage(data: any) {
            // TODO: origins
            console.log('sending ' + JSON.stringify(data, null, 2))
            window.postMessage(data, "*");
        }
        
        var runtime : yelm.rt.Runtime;        
        export function run(msg: SimulatorRunMessage) {
            if (runtime) {
                console.log('stopping preview runtime...')
                runtime.kill();
            }
            // TODO test data
            console.log('starting ' + msg.target);
            runtime = new Runtime(msg.code, msg.target);
            runtime.enums = msg.enums;
            switch(msg.target) {
                case 'microbit': initMicrobit(); break;
                case 'minecraft': initMinecraft(); break;
                default: console.error('unknown target');
            }
            
            postMessage({ kind: 'status', state: 'running' });
            runtime.run((v) => {
                
            })
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

