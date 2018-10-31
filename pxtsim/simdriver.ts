namespace pxsim {
    export interface SimulatorDriverOptions {
        revealElement?: (el: HTMLElement) => void;
        removeElement?: (el: HTMLElement, onComplete?: () => void) => void;
        unhideElement?: (el: HTMLElement) => void;
        onDebuggerWarning?: (wrn: DebuggerWarningMessage) => void;
        onDebuggerBreakpoint?: (brk: DebuggerBreakpointMessage) => void;
        onTraceMessage?: (msg: TraceMessage) => void;
        onDebuggerResume?: () => void;
        onStateChanged?: (state: SimulatorState) => void;
        onSimulatorCommand?: (msg: pxsim.SimulatorCommandMessage) => void;
        onTopLevelCodeEnd?: () => void;
        simUrl?: string;
        stoppedClass?: string;
    }

    export enum SimulatorState {
        Unloaded,
        Stopped,
        Running,
        Paused,
        Suspended
    }

    export enum SimulatorDebuggerCommand {
        StepInto,
        StepOver,
        StepOut,
        Resume,
        Pause
    }

    export interface SimulatorRunOptions {
        debug?: boolean;
        boardDefinition?: pxsim.BoardDefinition;
        parts?: string[];
        fnArgs?: any;
        aspectRatio?: number;
        partDefinitions?: pxsim.Map<PartDefinition>;
        mute?: boolean;
        highContrast?: boolean;
        light?: boolean;
        cdnUrl?: string;
        localizedStrings?: pxsim.Map<string>;
        refCountingDebug?: boolean;
        version?: string;
        clickTrigger?: boolean;
    }

    export interface HwDebugger {
        postMessage: (msg: pxsim.SimulatorMessage) => void;
    }

    export class SimulatorDriver {
        private themes = ["blue", "red", "green", "yellow"];
        private runId = '';
        private nextFrameId = 0;
        private frameCounter = 0;
        private currentRuntime: pxsim.SimulatorRunMessage;
        private listener: (ev: MessageEvent) => void;
        private traceInterval = 0;
        public runOptions: SimulatorRunOptions = {};
        public state = SimulatorState.Unloaded;
        public hwdbg: HwDebugger;

        constructor(public container: HTMLElement, public options: SimulatorDriverOptions = {}) {
        }

        public setHwDebugger(hw: HwDebugger) {
            if (hw) {
                // TODO set some visual on the simulator frame
                // in future the simulator frame could reflect changes in the hardware
                this.hwdbg = hw
                this.setState(SimulatorState.Running)
                this.container.style.opacity = "0.3"
            } else {
                delete this.container.style.opacity
                this.hwdbg = null
                this.setState(SimulatorState.Running)
                this.stop()
            }
        }

        public handleHwDebuggerMsg(msg: pxsim.SimulatorMessage) {
            if (!this.hwdbg) return
            this.handleMessage(msg)
        }

        public setThemes(themes: string[]) {
            U.assert(themes && themes.length > 0)
            this.themes = themes;
        }

        private setState(state: SimulatorState) {
            if (this.state != state) {
                this.state = state;
                this.freeze(this.state == SimulatorState.Paused); // don't allow interaction when pause
                if (this.options.onStateChanged)
                    this.options.onStateChanged(this.state);
            }
        }

        private freeze(value: boolean) {
            const cls = "pause-overlay";
            if (!value) {
                pxsim.util.toArray(this.container.querySelectorAll(`div.simframe div.${cls}`))
                    .forEach(overlay => overlay.parentElement.removeChild(overlay));
            } else {
                pxsim.util.toArray(this.container.querySelectorAll("div.simframe"))
                    .forEach(frame => {
                        if (frame.querySelector(`div.${cls}`))
                            return;
                        const div = document.createElement("div");
                        div.className = cls;
                        div.onclick = (ev) => {
                            ev.preventDefault();
                            return false;
                        };
                        frame.appendChild(div);
                    })
            }
        }

        public postMessage(msg: pxsim.SimulatorMessage, source?: Window) {
            if (this.hwdbg) {
                this.hwdbg.postMessage(msg)
                return
            }
            // dispatch to all iframe besides self
            let frames = this.container.getElementsByTagName("iframe");
            if (source && (msg.type === 'eventbus' || msg.type == 'radiopacket' || msg.type == 'irpacket' || msg.type == 'blepacket')) {
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

        private createFrame(light?: boolean): HTMLDivElement {
            const wrapper = document.createElement("div") as HTMLDivElement;
            wrapper.className = 'simframe';

            const frame = document.createElement('iframe') as HTMLIFrameElement;
            frame.id = 'sim-frame-' + this.nextId()
            frame.allowFullscreen = true;
            frame.setAttribute('allow', 'autoplay');
            frame.setAttribute('sandbox', 'allow-same-origin allow-scripts');
            let simUrl = this.options.simUrl || ((window as any).pxtConfig || {}).simUrl || "/sim/simulator.html"
            frame.className = 'no-select'
            if (this.runOptions.aspectRatio)
                wrapper.style.paddingBottom = (100 / this.runOptions.aspectRatio) + "%";
            frame.src = simUrl + '#' + frame.id;
            frame.frameBorder = "0";
            frame.dataset['runid'] = this.runId;

            wrapper.appendChild(frame);

            return wrapper;
        }

        public stop(unload = false) {
            this.clearDebugger();
            this.postMessage({ type: 'stop' });
            this.setState(SimulatorState.Stopped);
            if (unload) this.unload();
            else {
                let frames = this.container.getElementsByTagName("iframe");
                for (let i = 0; i < frames.length; ++i) {
                    let frame = frames[i] as HTMLIFrameElement
                    U.addClass(frame, this.getStoppedClass());
                }
                this.scheduleFrameCleanup();
            }
        }

        public suspend() {
            this.postMessage({ type: 'stop' });
            this.setState(SimulatorState.Suspended);

            let frames = this.container.getElementsByTagName("iframe");
            for (let i = 0; i < frames.length; ++i) {
                let frame = frames[i] as HTMLIFrameElement
                U.addClass(frame, this.getStoppedClass());
            }
            this.scheduleFrameCleanup();
        }

        private unload() {
            this.cancelFrameCleanup();
            pxsim.U.removeChildren(this.container);
            this.setState(SimulatorState.Unloaded);
        }

        public mute(mute: boolean) {
            this.postMessage({ type: 'mute', mute: mute } as pxsim.SimulatorMuteMessage);
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

        private applyAspectRatio() {
            let frames = this.container.getElementsByTagName("iframe");
            for (let i = 0; i < frames.length; ++i) {
                frames[i].parentElement.style.paddingBottom =
                    (100 / this.runOptions.aspectRatio) + "%";
            }
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

        public hide(completeHandler?: () => void) {
            if (!this.options.removeElement) return;
            let frames = this.container.getElementsByTagName("iframe");
            for (let i = 0; i < frames.length; ++i) {
                let frame = frames[i];
                this.options.removeElement(frame.parentElement, completeHandler);
            }
            // Execute the complete handler if there are no frames in sim view
            if (frames.length == 0 && completeHandler) {
                completeHandler();
            }
        }

        public unhide() {
            if (!this.options.unhideElement) return;
            let frames = this.container.getElementsByTagName("iframe");
            for (let i = 0; i < frames.length; ++i) {
                let frame = frames[i];
                this.options.unhideElement(frame.parentElement);
            }
        }

        public run(js: string, opts: SimulatorRunOptions = {}) {
            this.clearDebugger();
            this.runOptions = opts;
            this.runId = this.nextId();
            this.addEventListeners();

            // store information
            this.currentRuntime = {
                type: "run",
                boardDefinition: opts.boardDefinition,
                parts: opts.parts,
                fnArgs: opts.fnArgs,
                code: js,
                partDefinitions: opts.partDefinitions,
                mute: opts.mute,
                highContrast: opts.highContrast,
                light: opts.light,
                cdnUrl: opts.cdnUrl,
                localizedStrings: opts.localizedStrings,
                refCountingDebug: opts.refCountingDebug,
                version: opts.version,
                clickTrigger: opts.clickTrigger
            }

            this.applyAspectRatio();
            this.scheduleFrameCleanup();

            // first frame
            let frame = this.container.getElementsByTagName("iframe").item(0) as HTMLIFrameElement;
            // lazy allocate iframe
            if (!frame) {
                let wrapper = this.createFrame(opts.light);
                this.container.appendChild(wrapper);
                frame = wrapper.firstElementChild as HTMLIFrameElement;
            } else this.startFrame(frame);

            this.setState(SimulatorState.Running);
            this.setTraceInterval(this.traceInterval);
        }

        private startFrame(frame: HTMLIFrameElement) {
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
            U.removeClass(frame, this.getStoppedClass());
        }

        private removeEventListeners() {
            if (this.listener) {
                window.removeEventListener('message', this.listener, false);
                this.listener = undefined;
            }
        }

        private handleMessage(msg: pxsim.SimulatorMessage, source?: Window) {
            switch (msg.type || '') {
                case 'ready':
                    let frameid = (msg as pxsim.SimulatorReadyMessage).frameid;
                    let frame = document.getElementById(frameid) as HTMLIFrameElement;
                    if (frame) {
                        this.startFrame(frame);
                        if (this.options.revealElement)
                            this.options.revealElement(frame);
                    }
                    break;
                case 'simulator': this.handleSimulatorCommand(msg as pxsim.SimulatorCommandMessage); break; //handled elsewhere
                case 'serial': break; //handled elsewhere
                case 'pxteditor':
                case 'custom':
                    break; //handled elsewhere
                case 'debugger': this.handleDebuggerMessage(msg as DebuggerMessage); break;
                case 'toplevelcodefinished': if (this.options.onTopLevelCodeEnd) this.options.onTopLevelCodeEnd(); break;
                default:
                    this.postMessage(msg, source);
                    break;
            }
        }

        private addEventListeners() {
            if (!this.listener) {
                this.listener = (ev: MessageEvent) => {
                    if (this.hwdbg) return
                    this.handleMessage(ev.data, ev.source)
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
                case SimulatorDebuggerCommand.StepOut:
                    msg = 'stepout';
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
                    console.debug('unknown command')
                    return;
            }

            this.postMessage({ type: 'debugger', subtype: msg } as pxsim.DebuggerMessage)
        }

        public setBreakpoints(breakPoints: number[]) {
            this.postDebuggerMessage("config", { setBreakpoints: breakPoints })
        }

        public setTraceInterval(intervalMs: number) {
            this.traceInterval = intervalMs;
            this.postDebuggerMessage("traceConfig", { interval: intervalMs });
        }

        public variablesAsync(id: number): Promise<VariablesMessage> {
            return this.postDebuggerMessageAsync("variables", { variablesReference: id } as DebugProtocol.VariablesArguments)
                .then(msg => msg as VariablesMessage, e => undefined)
        }

        private handleSimulatorCommand(msg: pxsim.SimulatorCommandMessage) {
            if (this.options.onSimulatorCommand) this.options.onSimulatorCommand(msg);
        }

        private debuggerSeq = 1;
        private debuggerResolvers: Map<{ resolve: (msg: DebuggerMessage | PromiseLike<DebuggerMessage>) => void; reject: (error: any) => void; }> = {};

        private clearDebugger() {
            const e = new Error("Debugging cancelled");
            Object.keys(this.debuggerResolvers)
                .forEach(k => {
                    const { reject } = this.debuggerResolvers[k];
                    reject(e);
                })
            this.debuggerResolvers = {};
            this.debuggerSeq++;
        }

        private handleDebuggerMessage(msg: pxsim.DebuggerMessage) {
            if (msg.subtype !== "trace") {
                console.log("DBG-MSG", msg.subtype, msg)
            }

            // resolve any request
            if (msg.seq) {
                const { resolve } = this.debuggerResolvers[msg.seq];
                if (resolve)
                    resolve(msg);
            }

            switch (msg.subtype) {
                case "warning":
                    if (this.options.onDebuggerWarning)
                        this.options.onDebuggerWarning(msg as pxsim.DebuggerWarningMessage);
                    break;
                case "breakpoint":
                    let brk = msg as pxsim.DebuggerBreakpointMessage
                    if (this.state == SimulatorState.Running) {
                        if (brk.exceptionMessage)
                            this.suspend();
                        else
                            this.setState(SimulatorState.Paused);
                        if (this.options.onDebuggerBreakpoint)
                            this.options.onDebuggerBreakpoint(brk);
                    } else {
                        console.error("debugger: trying to pause from " + this.state);
                    }
                    break;
                case "trace":
                    if (this.options.onTraceMessage) {
                        this.options.onTraceMessage(msg as pxsim.TraceMessage);
                    }
                    break;
                default:
                    const seq = msg.req_seq;
                    if (seq) {
                        const { resolve } = this.debuggerResolvers[seq];
                        if (resolve) {
                            delete this.debuggerResolvers[seq];
                            resolve(msg)
                        }
                    }
                    break;
            }
        }

        private postDebuggerMessageAsync(subtype: string, data: any = {}): Promise<DebuggerMessage> {
            return new Promise((resolve, reject) => {
                const seq = this.debuggerSeq++;
                this.debuggerResolvers[seq.toString()] = { resolve, reject };
                this.postDebuggerMessage(subtype, data, seq);
            })
        }

        private postDebuggerMessage(subtype: string, data: any = {}, seq?: number) {
            const msg: pxsim.DebuggerMessage = JSON.parse(JSON.stringify(data))
            msg.type = "debugger"
            msg.subtype = subtype;
            if (seq)
                msg.seq = seq;
            this.postMessage(msg);
        }

        private nextId(): string {
            return this.nextFrameId++ + (Math.random() + '' + Math.random()).replace(/[^\d]/, '')
        }

        private getStoppedClass() {
            if (this.options && this.options.stoppedClass) {
                return this.options.stoppedClass;
            }
            return "grayscale";
        }
    }
}
