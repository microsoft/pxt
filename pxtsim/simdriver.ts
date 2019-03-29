namespace pxsim {
    export interface SimulatorDriverOptions {
        restart?: () => void; // restart simulator
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
        invalidatedClass?: string;
        autoRun?: boolean;
    }

    export enum SimulatorState {
        Unloaded,
        Stopped,
        Pending,
        Starting,
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
        private _currentRuntime: pxsim.SimulatorRunMessage;
        private listener: (ev: MessageEvent) => void;
        private traceInterval = 0;
        public runOptions: SimulatorRunOptions = {};
        public state = SimulatorState.Unloaded;
        public hwdbg: HwDebugger;

        // we might "loan" a simulator when the user is recording
        // screenshots for sharing
        private loanedSimulator: HTMLDivElement;

        constructor(public container: HTMLElement, public options: SimulatorDriverOptions = {}) {
        }

        isDebug() {
            return this.runOptions && !!this.runOptions.debug;
        }

        setDirty() {
            // We suspend the simulator here to stop it from running without
            // interfering with the user's stopped state. We're not doing this check
            // in the driver because the driver should be able to switch from any state
            // to the suspend state, but in this codepath we only want to switch to the
            // suspended state if we're running
            if (this.state == pxsim.SimulatorState.Running) this.suspend();
        }

        setPending() {
            this.setState(SimulatorState.Pending);
        }

        private setStarting() {
            this.setState(SimulatorState.Starting);
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

        public startRecording(width?: number): void {
            const frame = this.simFrames()[0];
            if (!frame) return undefined;

            this.postMessage(<SimulatorRecorderMessage>{
                type: 'recorder',
                action: 'start',
                width
            });
        }

        public stopRecording() {
            this.postMessage(<SimulatorRecorderMessage>{ type: 'recorder', action: 'stop' })
        }

        private setFrameState(frame: HTMLIFrameElement) {
            const icon = frame.nextElementSibling as HTMLElement;
            const loader = icon.nextElementSibling as HTMLElement;
            // apply state
            switch (this.state) {
                case SimulatorState.Pending:
                case SimulatorState.Starting:
                    icon.style.display = '';
                    icon.className = '';
                    loader.style.display = '';
                    break;
                case SimulatorState.Stopped:
                case SimulatorState.Suspended:
                    U.addClass(frame, (this.state == SimulatorState.Stopped || this.options.autoRun)
                        ? this.stoppedClass : this.invalidatedClass);
                    if (!this.options.autoRun) {
                        icon.style.display = '';
                        icon.className = 'videoplay xicon icon';
                    } else
                        icon.style.display = 'none';
                    loader.style.display = 'none';
                    this.scheduleFrameCleanup();
                    break;
                default:
                    U.removeClass(frame, this.stoppedClass);
                    U.removeClass(frame, this.invalidatedClass);
                    icon.style.display = 'none';
                    loader.style.display = 'none';
                    break;
            }
        }

        private setState(state: SimulatorState) {
            if (this.state != state) {
                this.state = state;
                this.freeze(this.state == SimulatorState.Paused); // don't allow interaction when pause
                this.simFrames().forEach(frame => this.setFrameState(frame));
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

        private simFrames(skipLoaned = false): HTMLIFrameElement[] {
            let frames = pxsim.util.toArray(this.container.getElementsByTagName("iframe"));
            const loanedFrame = this.loanedIFrame();
            if (loanedFrame && !skipLoaned)
                frames.unshift(loanedFrame);
            return frames;
        }

        public postMessage(msg: pxsim.SimulatorMessage, source?: Window) {
            if (this.hwdbg) {
                this.hwdbg.postMessage(msg)
                return
            }
            // dispatch to all iframe besides self
            let frames = this.simFrames();
            const broadcastmsg = msg as pxsim.SimulatorBroadcastMessage;
            if (source && broadcastmsg && !!broadcastmsg.broadcast) {
                if (frames.length < 2) {
                    this.container.appendChild(this.createFrame());
                    frames = this.simFrames();
                } else if (frames[1].dataset['runid'] != this.runId) {
                    this.startFrame(frames[1]);
                }
            }

            for (let i = 0; i < frames.length; ++i) {
                let frame = frames[i] as HTMLIFrameElement
                // same frame as source
                if (source && frame.contentWindow == source) continue;
                // frame not in DOM
                if (!frame.contentWindow) continue;

                frame.contentWindow.postMessage(msg, "*");

                // don't start more than 1 recorder
                if (msg.type == 'recorder'
                    && (<pxsim.SimulatorRecorderMessage>msg).action == "start")
                    break;
            }
        }

        private createFrame(light?: boolean): HTMLDivElement {
            const wrapper = document.createElement("div") as HTMLDivElement;
            wrapper.className = `simframe ui embed`;

            const frame = document.createElement('iframe') as HTMLIFrameElement;
            frame.id = 'sim-frame-' + this.nextId()
            frame.title = pxsim.localization.lf("Simulator")
            frame.allowFullscreen = true;
            frame.setAttribute('allow', 'autoplay');
            frame.setAttribute('sandbox', 'allow-same-origin allow-scripts');
            let simUrl = this.options.simUrl || ((window as any).pxtConfig || {}).simUrl || "/sim/simulator.html"
            frame.className = 'no-select'
            frame.src = simUrl + '#' + frame.id;
            frame.frameBorder = "0";
            frame.dataset['runid'] = this.runId;

            wrapper.appendChild(frame);

            const i = document.createElement("i");
            i.className = "videoplay xicon icon";
            i.style.display = "none";
            i.onclick = (ev) => {
                ev.preventDefault();
                if (this.state != SimulatorState.Running
                    && this.state != SimulatorState.Starting) {
                    // we need to request to restart the simulator
                    if (this.options.restart)
                        this.options.restart();
                    else
                        this.start();
                }
                return false;
            }
            wrapper.appendChild(i);

            const l = document.createElement("div");
            l.className = "ui active loader";
            i.style.display = "none";
            wrapper.appendChild(l);

            if (this.runOptions)
                this.applyAspectRatioToFrame(frame);

            return wrapper;
        }

        public preload(aspectRatio: number) {
            if (!this.simFrames().length) {
                this.container.appendChild(this.createFrame());
                this.applyAspectRatio(aspectRatio);
                this.setStarting();
            }
        }

        public stop(unload = false, starting = false) {
            this.clearDebugger();
            this.postMessage({ type: 'stop' });
            this.setState(starting ? SimulatorState.Starting : SimulatorState.Stopped);
            if (unload)
                this.unload();
        }

        public suspend() {
            this.postMessage({ type: 'stop' });
            this.setState(SimulatorState.Suspended);
        }

        private unload() {
            this.cancelFrameCleanup();
            pxsim.U.removeChildren(this.container);
            this.setState(SimulatorState.Unloaded);
            this.runOptions = undefined; // forget about program
            this._currentRuntime = undefined;
            this.runId = undefined;
        }

        public mute(mute: boolean) {
            this.postMessage({ type: 'mute', mute: mute } as pxsim.SimulatorMuteMessage);
        }

        public isLoanedSimulator(el: HTMLElement) {
            return !!this.loanedSimulator && this.loanedIFrame() == el;
        }

        // returns a simulator iframe that can be hosted anywhere in the page
        // while a loaned simulator is active, all other iframes are suspended
        public loanSimulator(): HTMLDivElement {
            if (this.loanedSimulator) return this.loanedSimulator;

            // reuse first simulator or create new one
            this.loanedSimulator = (this.container.firstElementChild as HTMLDivElement) || this.createFrame();
            if (this.loanedSimulator.parentNode)
                this.container.removeChild(this.loanedSimulator);
            return this.loanedSimulator;
        }

        public unloanSimulator() {
            if (this.loanedSimulator) {
                if (this.loanedSimulator.parentNode)
                    this.loanedSimulator.parentNode.removeChild(this.loanedSimulator);
                this.container.insertBefore(this.loanedSimulator, this.container.firstElementChild);
                delete this.loanedSimulator;
            }
        }

        private loanedIFrame(): HTMLIFrameElement {
            return this.loanedSimulator
                && this.loanedSimulator.parentNode
                && this.loanedSimulator.querySelector("iframe");
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

        private applyAspectRatio(ratio?: number) {
            if (!ratio && !this.runOptions) return;
            const frames = this.simFrames();
            frames.forEach(frame => this.applyAspectRatioToFrame(frame, ratio));
        }

        private applyAspectRatioToFrame(frame: HTMLIFrameElement, ratio?: number) {
            const r = ratio || this.runOptions.aspectRatio;
            frame.parentElement.style.paddingBottom =
                (100 / r) + "%";
        }

        private cleanupFrames() {
            // drop unused extras frames after 5 seconds
            const frames = this.simFrames(true);
            frames.shift(); // drop first frame
            frames.forEach(frame => {
                if (this.state == SimulatorState.Stopped
                    || frame.dataset['runid'] != this.runId) {
                    if (this.options.removeElement) this.options.removeElement(frame.parentElement);
                    else frame.parentElement.remove();
                }
            });
        }

        public hide(completeHandler?: () => void) {
            this.suspend();
            if (!this.options.removeElement) return;

            const frames = this.simFrames();
            frames.forEach(frame => {
                this.options.removeElement(frame.parentElement, completeHandler);
            });
            // Execute the complete handler if there are no frames in sim view
            if (frames.length == 0 && completeHandler) {
                completeHandler();
            }
        }

        public unhide() {
            if (!this.options.unhideElement) return;

            const frames = this.simFrames();
            frames.forEach(frame => {
                this.options.unhideElement(frame.parentElement);
            });
        }

        public run(js: string, opts: SimulatorRunOptions = {}) {
            this.runOptions = opts;
            this.runId = this.nextId();
            // store information
            this._currentRuntime = {
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
            this.start();
        }

        public restart() {
            this.stop();
            this.start();
        }

        private start() {
            this.clearDebugger();
            this.addEventListeners();
            this.applyAspectRatio();
            this.scheduleFrameCleanup();

            if (!this._currentRuntime) return; // nothing to do

            // first frame
            let frame = this.simFrames()[0];
            if (!frame) {
                let wrapper = this.createFrame(this.runOptions && this.runOptions.light);
                this.container.appendChild(wrapper);
                frame = wrapper.firstElementChild as HTMLIFrameElement;
            } else // reuse simulator
                this.startFrame(frame);

            this.setState(SimulatorState.Running);
            this.setTraceInterval(this.traceInterval);
        }

        // ensure _currentRuntime is ready
        private startFrame(frame: HTMLIFrameElement): boolean {
            if (!this._currentRuntime || !frame.contentWindow) return false;
            let msg = JSON.parse(JSON.stringify(this._currentRuntime)) as pxsim.SimulatorRunMessage;
            let mc = '';
            let m = /player=([A-Za-z0-9]+)/i.exec(window.location.href); if (m) mc = m[1];
            msg.frameCounter = ++this.frameCounter;
            msg.options = {
                theme: this.themes[this.nextFrameId++ % this.themes.length],
                player: mc
            };
            msg.id = `${msg.options.theme}-${this.nextId()}`;
            frame.dataset['runid'] = this.runId;
            frame.dataset['runtimeid'] = msg.id;
            frame.contentWindow.postMessage(msg, "*");
            this.setFrameState(frame);
            return true;
        }

        private handleMessage(msg: pxsim.SimulatorMessage, source?: Window) {
            switch (msg.type || '') {
                case 'ready': {
                    const frameid = (msg as pxsim.SimulatorReadyMessage).frameid;
                    const frame = document.getElementById(frameid) as HTMLIFrameElement;
                    if (frame) {
                        this.startFrame(frame);
                        if (this.options.revealElement)
                            this.options.revealElement(frame);
                    }
                    break;
                }
                case 'status': {
                    const frameid = (msg as pxsim.SimulatorReadyMessage).frameid;
                    const frame = document.getElementById(frameid) as HTMLIFrameElement;
                    if (frame) {
                        const stmsg = msg as SimulatorStateMessage;
                        switch (stmsg.state) {
                            case "killed":
                                if (stmsg.runtimeid == frame.dataset['runtimeid'])
                                    this.setState(SimulatorState.Stopped);
                                break;
                        }
                    }
                    break;
                }
                case 'simulator': this.handleSimulatorCommand(msg as pxsim.SimulatorCommandMessage); break; //handled elsewhere
                case 'serial':
                case 'pxteditor':
                case 'screenshot':
                case 'custom':
                case 'recorder':
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

        private removeEventListeners() {
            if (this.listener) {
                window.removeEventListener('message', this.listener, false);
                this.listener = undefined;
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

        public variablesAsync(id: number, fields?: string[]): Promise<VariablesMessage> {
            return this.postDebuggerMessageAsync("variables", { variablesReference: id, fields: fields } as DebugProtocol.VariablesArguments)
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
                        let stackTrace = brk.exceptionMessage + "\n"
                        for (let s of brk.stackframes) {
                            let fi = s.funcInfo
                            stackTrace += `   at ${fi.functionName} (${fi.fileName}:${fi.line + 1}:${fi.column + 1})\n`
                        }
                        if (brk.exceptionMessage) console.error(stackTrace);
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

        private get stoppedClass() {
            return (this.options && this.options.stoppedClass) || "grayscale";
        }

        private get invalidatedClass() {
            return (this.options && this.options.invalidatedClass) || "sepia";
        }
    }
}
