namespace pxsim {
    export interface SimulatorDriverOptions {
        revealElement?: (el: HTMLElement) => void;
        removeElement?: (el: HTMLElement) => void;
        onDebuggerBreakpoint?: (brk: DebuggerBreakpointMessage) => void;
        onDebuggerResume?: () => void;
        onCompile?: (name: string, content: string, contentType: string) => void;
        onStateChanged?: (state: SimulatorState) => void;
        simUrl?: string;
        aspectRatio?: number;
    }

    export enum SimulatorState {
        Unloaded,
        Stopped,
        Running,
        Paused
    }

    export enum SimulatorDebuggerCommand {
        StepInto,
        StepOver,
        Resume,
        Pause
    }

    export class SimulatorDriver {
        private themes = ["blue", "red", "green", "yellow"];
        private runId = '';
        private nextFrameId = 0;
        private frameCounter = 0;
        private currentRuntime: pxsim.SimulatorRunMessage;
        private listener: (ev: MessageEvent) => void;
        public debug = false;
        public state = SimulatorState.Unloaded;

        constructor(public container: HTMLElement, public options: SimulatorDriverOptions = {}) {
        }

        public setThemes(themes: string[]) {
            U.assert(themes && themes.length > 0)
            this.themes = themes;
        }

        private setState(state: SimulatorState) {
            if (this.state != state) {
                console.log(`simulator: ${this.state} -> ${state}`);
                this.state = state;
                if (this.options.onStateChanged)
                    this.options.onStateChanged(this.state);
            }
        }

        private postMessage(msg: pxsim.SimulatorMessage, source?: Window) {
            // dispatch to all iframe besides self
            let frames = this.container.getElementsByTagName("iframe");
            if (source && (msg.type === 'eventbus' || msg.type == 'radiopacket')) {
                if (frames.length < 2) {
                    this.container.appendChild(this.createFrame());
                    frames = this.container.getElementsByTagName("iframe");
                } else if (frames[1].dataset['runid'] != this.runId) {
                    this.startFrame(frames[1]);
                }
            }

            for (let i = 0; i < frames.length; ++i) {
                let frame = frames[i] as HTMLIFrameElement
                if (source && frame.contentWindow == source) continue;

                frame.contentWindow.postMessage(msg, "*");
            }
        }

        private createFrame(): HTMLDivElement {
            let wrapper = document.createElement("div") as HTMLDivElement;
            wrapper.className = 'simframe';

            let frame = document.createElement('iframe') as HTMLIFrameElement;
            frame.id = 'sim-frame-' + this.nextId()
            frame.allowFullscreen = true;
            frame.setAttribute('sandbox', 'allow-same-origin allow-scripts');
            let simUrl = this.options.simUrl || ((window as any).pxtConfig || {}).simUrl || "/sim/simulator.html"
            if (this.options.aspectRatio)
                wrapper.style.paddingBottom = (100 / this.options.aspectRatio) + "%";
            frame.src = simUrl + '#' + frame.id;
            frame.frameBorder = "0";
            frame.dataset['runid'] = this.runId;

            wrapper.appendChild(frame);

            return wrapper;
        }

        public stop(unload = false) {
            this.postMessage({ type: 'stop' });
            this.setState(SimulatorState.Stopped);
            if (unload) this.unload();
            else {
                let frames = this.container.getElementsByTagName("iframe");
                for (let i = 0; i < frames.length; ++i) {
                    let frame = frames[i] as HTMLIFrameElement
                    if (!/grayscale/.test(frame.className))
                        U.addClass(frame, "grayscale");
                }
                this.scheduleFrameCleanup();
            }
        }

        private unload() {
            this.cancelFrameCleanup();
            this.container.innerHTML = '';
            this.setState(SimulatorState.Unloaded);
        }

        private frameCleanupTimeout = 0;
        private cancelFrameCleanup() {
            if (this.frameCleanupTimeout) {
                clearTimeout(this.frameCleanupTimeout);
                this.frameCleanupTimeout = 0;
            }
        }
        private scheduleFrameCleanup() {
            this.cancelFrameCleanup();
            this.frameCleanupTimeout = setTimeout(() => {
                this.frameCleanupTimeout = 0;
                this.cleanupFrames();
            }, 5000);
        }
        private cleanupFrames() {
            // drop unused extras frames after 5 seconds
            let frames = this.container.getElementsByTagName("iframe");
            for (let i = 1; i < frames.length; ++i) {
                let frame = frames[i];
                if (this.state == SimulatorState.Stopped
                    || frame.dataset['runid'] != this.runId) {
                    if (this.options.removeElement) this.options.removeElement(frame.parentElement);
                    else frame.parentElement.remove();
                }
            }
        }

        public run(js: string, debug?: boolean) {
            this.debug = debug;
            this.runId = this.nextId();
            this.addEventListeners();

            // store information
            this.currentRuntime = {
                type: 'run',
                code: js
            }

            this.scheduleFrameCleanup();

            // first frame            
            let frame = this.container.querySelector("iframe") as HTMLIFrameElement;
            // lazy allocate iframe
            if (!frame) {
                let wrapper = this.createFrame();
                this.container.appendChild(wrapper);
                frame = wrapper.firstElementChild as HTMLIFrameElement;
            } else this.startFrame(frame);

            this.setState(SimulatorState.Running);
        }

        private startFrame(frame: HTMLIFrameElement) {
            console.log(`starting frame ${frame.id}`);
            let msg = JSON.parse(JSON.stringify(this.currentRuntime)) as pxsim.SimulatorRunMessage;
            let mc = '';
            let m = /player=([A-Za-z0-9]+)/i.exec(window.location.href); if (m) mc = m[1];
            msg.frameCounter = ++this.frameCounter;
            msg.options = {
                theme: this.themes[this.nextFrameId++ % this.themes.length],
                player: mc
            };
            msg.id = `${msg.options.theme}-${this.nextId()}`;
            frame.dataset['runid'] = this.runId;
            frame.contentWindow.postMessage(msg, "*");
            U.removeClass(frame, "grayscale");
        }

        private removeEventListeners() {
            if (this.listener) {
                window.removeEventListener('message', this.listener, false);
                this.listener = undefined;
            }
        }

        private addEventListeners() {
            if (!this.listener) {
                this.listener = (ev: MessageEvent) => {
                    let msg = ev.data;
                    switch (msg.type || '') {
                        case 'ready':
                            let frameid = (msg as pxsim.SimulatorReadyMessage).frameid;
                            console.log(`frame ${frameid} ready`)
                            let frame = document.getElementById(frameid) as HTMLIFrameElement;
                            if (frame) {
                                this.startFrame(frame);
                                if (this.options.revealElement)
                                    this.options.revealElement(frame);
                            }
                            break;
                        case 'serial': break; //handled elsewhere
                        case 'debugger': this.handleDebuggerMessage(msg); break;
                        case 'compile':
                            let cmp = msg as pxsim.SimulatorCompilationMessage;
                            if (this.options.onCompile)
                                this.options.onCompile(cmp.name, cmp.content, cmp.contentType);
                            break;
                        default:
                            if (msg.type == 'radiopacket') {
                                // assign rssi noisy?
                                (msg as pxsim.SimulatorRadioPacketMessage).rssi = 10;
                            }
                            this.postMessage(ev.data, ev.source);
                            break;
                    }
                }
                window.addEventListener('message', this.listener, false);
            }
        }

        public resume(c: SimulatorDebuggerCommand) {
            let msg: string;
            switch (c) {
                case SimulatorDebuggerCommand.Resume:
                    msg = 'resume';
                    this.setState(SimulatorState.Running);
                    break;
                case SimulatorDebuggerCommand.StepInto:
                    msg = 'stepinto';
                    this.setState(SimulatorState.Running);
                    break;
                case SimulatorDebuggerCommand.StepOver:
                    msg = 'stepover';
                    this.setState(SimulatorState.Running);
                    break;
                case SimulatorDebuggerCommand.Pause:
                    msg = 'pause';
                    break;
                default:
                    console.log('unknown command')
                    return;
            }

            this.postDebuggerMessage(msg)
        }

        private handleDebuggerMessage(msg: pxsim.DebuggerMessage) {
            console.log("DBG-MSG", msg.subtype, msg)
            switch (msg.subtype) {
                case "breakpoint":
                    let brk = msg as pxsim.DebuggerBreakpointMessage
                    if (this.state == SimulatorState.Running) {
                        this.setState(SimulatorState.Paused);
                        if (this.options.onDebuggerBreakpoint)
                            this.options.onDebuggerBreakpoint(brk);
                    } else {
                        console.error("debugger: trying to pause from " + this.state);
                    }
                    break;
            }
        }

        private postDebuggerMessage(subtype: string, data: any = {}) {
            let msg: pxsim.DebuggerMessage = JSON.parse(JSON.stringify(data))
            msg.type = "debugger"
            msg.subtype = subtype
            this.postMessage(msg)
        }

        private nextId(): string {
            return this.nextFrameId++ + (Math.random() + '' + Math.random()).replace(/[^\d]/, '')
        }
    }
}