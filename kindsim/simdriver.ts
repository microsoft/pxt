namespace ks.rt {
    export class SimulatorDriver {
        private frameCounter = 0;
        private currentRuntime: ks.rt.SimulatorRunMessage;
        private listener : (ev : MessageEvent) => void;

        constructor(public container: HTMLElement) {

        }

        private postMessage(msg: ks.rt.SimulatorMessage, source?: Window) {
            // dispatch to all iframe besides self
            let frames = this.container.getElementsByTagName("iframe");
            if (source && (msg.type === 'eventbus' || msg.type == 'radiopacket') && frames.length < 2) {
                let frame = this.createFrame()
                this.container.appendChild(frame);
                frames = this.container.getElementsByTagName("iframe");
            }

            for (let i = 0; i < frames.length; ++i) {
                let frame = frames[i] as HTMLIFrameElement
                if (source && frame.contentWindow == source) return;

                frame.contentWindow.postMessage(msg, "*");
            }
        }

        private createFrame(): HTMLIFrameElement {
            let frame = document.createElement('iframe') as HTMLIFrameElement;
            frame.id = 'sim-frame-' + this.nextId()
            frame.className = 'simframe';
            frame.setAttribute('sandbox', 'allow-same-origin allow-scripts');
            let cdn = (window as any).simCdnRoot
            frame.src = cdn + 'simulator.html#' + frame.id;
            frame.frameBorder = "0";
            return frame;
        }

        public stop(unload = false) {
            this.postMessage({ type: 'stop' });
            if (unload) this.unload();
        }
        
        private unload() {
            this.container.innerHTML = '';
        }
        
        public run(js: string, enums: any) {
            this.addEventListeners();
            
            // store information
            this.currentRuntime = {
                type: 'run',
                enums: enums,
                code: js
            }

            // drop extras frames
            while(this.container.childElementCount > 1)
                this.container.removeChild(this.container.lastElementChild);
            // first frame            
            let frame = this.container.querySelector("iframe:first") as HTMLIFrameElement;
            // lazy allocate iframe
            if (!frame) {
                frame = this.createFrame();
                this.container.appendChild(frame);
                // delay started
            } else
                this.startFrame(frame);
        }

        private startFrame(frame: HTMLIFrameElement) {
            let msg = JSON.parse(JSON.stringify(this.currentRuntime)) as ks.rt.SimulatorRunMessage;
            let mc = '';
            let m = /player=([A-Za-z0-9]+)/i.exec(window.location.href); if (m) mc = m[1];
            msg.frameCounter = ++this.frameCounter;
            msg.options = {
                player: mc
            };
            msg.id = `${msg.options.theme}-${this.nextId()}`;
            frame.contentWindow.postMessage(msg, "*");
        }
        
        private removeEventListeners() {
            if (this.listener) {
                window.removeEventListener('message', this.listener, false);
                this.listener = undefined;
            }
        }

        private addEventListeners() {
            this.listener = (ev: MessageEvent) => {
                let msg = ev.data;
                switch (msg.type || '') {
                    case 'ready':
                        let frameid = (msg as ks.rt.SimulatorReadyMessage).frameid;
                        let frame = document.getElementById(frameid) as HTMLIFrameElement;
                        if (frame) this.startFrame(frame);
                        break;
                    case 'serial': break; //handled elsewhere
                    default:
                        if (msg.type == 'radiopacket') {
                            // assign rssi noisy?
                            (msg as ks.rt.SimulatorRadioPacketMessage).rssi = 10;
                        }
                        this.postMessage(ev.data, ev.source);
                        break;
                }
            }
            window.addEventListener('message', this.listener, false);
        }

        private nextId(): string {
            return (Math.random() + '' + Math.random()).replace(/[^\d]/, '')
        }
    }
}