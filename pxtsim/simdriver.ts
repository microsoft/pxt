namespace pxsim {
    export interface SimulatorDriverOptions {
        restart?: () => void; // restart simulator
        revealElement?: (el: HTMLElement) => void;
        removeElement?: (el: HTMLElement, onComplete?: () => void) => void;
        unhideElement?: (el: HTMLElement) => void;
        onDebuggerWarning?: (wrn: DebuggerWarningMessage) => void;
        onDebuggerBreakpoint?: (brk: DebuggerBreakpointMessage) => void;
        onTraceMessage?: (msg: DebuggerBreakpointMessage) => void;
        onDebuggerResume?: () => void;
        onStateChanged?: (state: SimulatorState) => void;
        onSimulatorReady?: () => void;
        onSimulatorCommand?: (msg: pxsim.SimulatorCommandMessage) => void;
        onTopLevelCodeEnd?: () => void;
        onMuteButtonStateChange?: (state: "muted" | "unmuted" | "disabled") => void;
        simUrl?: string;
        stoppedClass?: string;
        invalidatedClass?: string;
        // instead of spanning multiple simulators,
        // dispatch messages to parent window
        nestedEditorSim?: boolean;
        parentOrigin?: string;
        mpRole?: string;    // multiplayer role: "client", "server", or undefined
        messageSimulators?: pxt.Map<{
            url: string;
            localHostUrl?: string;
            aspectRatio?: number;
            permanent?: boolean;
        }>;
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
        trace?: boolean;
        boardDefinition?: pxsim.BoardDefinition;
        parts?: string[];
        builtinParts?: string[];
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
        breakOnStart?: boolean;
        storedState?: Map<any>;
        autoRun?: boolean;
        ipc?: boolean;
        dependencies?: Map<string>;
        // single iframe, no message simulators
        single?: boolean;
        hideSimButtons?: boolean;
        autofocus?: boolean;
        queryParameters?: string;
        mpRole?: "server" | "client";
        activePlayer?: 1 | 2 | 3 | 4 | undefined;
        theme?: string | pxt.Map<string>;
    }

    export interface HwDebugger {
        postMessage: (msg: pxsim.SimulatorMessage) => void;
    }

    const FRAME_DATA_MESSAGE_CHANNEL = "messagechannel"
    const FRAME_ASPECT_RATIO = "aspectratio"
    const MESSAGE_SOURCE = "pxtdriver"
    const PERMANENT = "permanent"

    export class SimulatorDriver {
        private themes = ["blue", "red", "green", "yellow"];
        private runId = '';
        private nextFrameId = 0;
        private frameCounter = 0;
        private _currentRuntime: pxsim.SimulatorRunMessage;
        private listener: (ev: MessageEvent) => void;
        private traceInterval = 0;
        private breakpointsSet = false;
        private _runOptions: SimulatorRunOptions = {};
        public state = SimulatorState.Unloaded;
        public hwdbg: HwDebugger;
        private _dependentEditors: Window[];
        private _allowedOrigins: string[] = [];
        private debuggingFrame: string;

        // we might "loan" a simulator when the user is recording
        // screenshots for sharing
        private loanedSimulator: HTMLDivElement;

        constructor(public container: HTMLElement,
            public options: SimulatorDriverOptions = {}) {

            this._allowedOrigins.push(window.location.origin);
            if (options.parentOrigin) {
                this._allowedOrigins.push(options.parentOrigin)
            }

            this._allowedOrigins.push(this.getSimUrl().origin);

            const messageSimulators = options?.messageSimulators
            if (messageSimulators) {
                Object.keys(messageSimulators)
                    .map(channel => messageSimulators[channel])
                    .forEach(messageSimulator => {
                        this._allowedOrigins.push(new URL(messageSimulator.url).origin);
                        if (messageSimulator.localHostUrl)
                            this._allowedOrigins.push(new URL(messageSimulator.localHostUrl).origin);
                    });
            }
            this._allowedOrigins = U.unique(this._allowedOrigins, f => f);
        }

        isDebug() {
            return this._runOptions && !!this._runOptions.debug;
        }

        isTracing() {
            return this._runOptions && !!this._runOptions.trace;
        }

        hasParts(): boolean {
            return this._runOptions && this._runOptions.parts && !!this._runOptions.parts.length;
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

        focus() {
            const frame = this.simFrames()[0];
            if (frame) frame.focus();
        }

        registerDependentEditor(w: Window) {
            if (!w) return;
            if (!this._dependentEditors)
                this._dependentEditors = [];
            this._dependentEditors.push(w);
        }

        private dependentEditors() {
            if (this._dependentEditors) {
                this._dependentEditors = this._dependentEditors.filter(w => !!w.parent)
                if (!this._dependentEditors.length)
                    this._dependentEditors = undefined;
            }
            return this._dependentEditors;
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
                source: MESSAGE_SOURCE,
                width
            });
        }

        public stopRecording() {
            this.postMessage(<SimulatorRecorderMessage>{ type: 'recorder', source: MESSAGE_SOURCE, action: 'stop' })
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
                    pxsim.U.addClass(frame,
                        (this.state == SimulatorState.Stopped || (this._runOptions && this._runOptions.autoRun))
                            ? this.stoppedClass : this.invalidatedClass);
                    if (!this._runOptions || !this._runOptions.autoRun) {
                        icon.style.display = '';
                        icon.className = 'videoplay xicon icon';
                    } else
                        icon.style.display = 'none';
                    loader.style.display = 'none';
                    this.scheduleFrameCleanup();
                    break;
                default:
                    pxsim.U.removeClass(frame, this.stoppedClass);
                    pxsim.U.removeClass(frame, this.invalidatedClass);
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

        private getSimUrl(): URL {
            const simUrl = this.options.simUrl || (window as any).pxtConfig?.simUrl || (pxt as any).webConfig?.simUrl || `${location.origin}/sim/simulator.html`;
            try {
                return new URL(simUrl);
            } catch {
                // Failed to parse set url; try based off origin in case path defined as relative (e.g. /simulator.html)
                return new URL(simUrl, location.origin);
            }
        }

        public postMessage(msg: pxsim.SimulatorMessage, source?: Window, frameID?: string) {
            if (this.hwdbg) {
                this.hwdbg.postMessage(msg)
                return
            }

            const depEditors = this.dependentEditors();
            let frames = this.simFrames();

            if (frameID) frames = frames.filter(f => f.id === frameID);

            let isDeferrableBroadcastMessage = false;

            const broadcastmsg = msg as pxsim.SimulatorBroadcastMessage;
            if (source && broadcastmsg?.broadcast) {
                // if the editor is hosted in a multi-editor setting
                // don't start extra frames
                const single = !!this._currentRuntime?.single;
                const parentWindow = window.parent && window.parent !== window.window
                    ? window.parent : window.opener;
                if (parentWindow) {
                    // if message comes from parent already, don't echo
                    if (source !== parentWindow) {
                        // posting sim messages to parent frame; no origin restriction.
                        parentWindow.postMessage(msg, "*");
                    }
                }
                if (!this.options.nestedEditorSim && !broadcastmsg?.toParentIFrameOnly) {
                    // send message to other editors
                    if (depEditors) {
                        depEditors.forEach(w => {
                            if (source !== w)
                                // dependant editors should be in the same origin
                                w.postMessage(msg, window.location.origin)
                        })
                        // start second simulator
                    } else if (!single) {
                        const messageChannel = msg.type === "messagepacket" && (msg as SimulatorControlMessage).channel;
                        const messageSimulator = messageChannel &&
                            this.options.messageSimulators &&
                            this.options.messageSimulators[messageChannel];
                        // should we start an extension editor?
                        if (messageSimulator) {
                            // find a frame already running that simulator
                            let messageFrame = frames.find(frame => frame.dataset[FRAME_DATA_MESSAGE_CHANNEL] === messageChannel);
                            // not found, spin a new one
                            if (!messageFrame) {
                                const useLocalHost = U.isLocalHost() && /localhostmessagesims=1/i.test(window.location.href)
                                const url = ((useLocalHost && messageSimulator.localHostUrl) || messageSimulator.url)
                                    .replace("$PARENT_ORIGIN$", encodeURIComponent(this.options.parentOrigin || ""))
                                let wrapper = this.createFrame(url);
                                this.container.appendChild(wrapper);
                                messageFrame = wrapper.firstElementChild as HTMLIFrameElement;
                                messageFrame.dataset[FRAME_DATA_MESSAGE_CHANNEL] = messageChannel;
                                pxsim.U.addClass(wrapper, "simmsg")
                                pxsim.U.addClass(wrapper, "simmsg" + messageChannel)
                                if (messageSimulator.permanent)
                                    messageFrame.dataset[PERMANENT] = "true";
                                this.startFrame(messageFrame);
                                frames = this.simFrames(); // refresh
                            }
                            // not running the curren run, restart
                            else if (messageFrame.dataset['runid'] != this.runId) {
                                this.startFrame(messageFrame);
                            }
                        } else {
                            isDeferrableBroadcastMessage = true;
                            // start secondary frame if needed
                            const mkcdFrames = frames.filter(frame => !frame.dataset[FRAME_DATA_MESSAGE_CHANNEL]);
                            if (mkcdFrames.length < 2) {
                                this.container.appendChild(this.createFrame());
                                frames = this.simFrames();
                                // there might be an old frame
                            } else if (mkcdFrames[1].dataset['runid'] != this.runId) {
                                this.startFrame(mkcdFrames[1]);
                            }
                        }
                    }
                }
            }

            // now that we have iframe starts,
            // dispatch message to other frames
            for (let i = 0; i < frames.length; ++i) {
                const frame = frames[i] as HTMLIFrameElement
                // same frame as source
                if (source && frame.contentWindow == source) continue;
                // frame not in DOM
                if (!frame.contentWindow) continue;

                // finally, send the message
                if (isDeferrableBroadcastMessage) {
                    this.postDeferrableMessage(frame, msg);
                } else {
                    this.postMessageCore(frame, msg);
                }

                // don't start more than 1 recorder
                if (msg.type == 'recorder'
                    && (<pxsim.SimulatorRecorderMessage>msg).action == "start")
                    break;
            }
        }

        protected deferredMessages: [HTMLIFrameElement, SimulatorMessage][];
        protected postDeferrableMessage(frame: HTMLIFrameElement, msg: SimulatorMessage) {
            const frameStarted = !frame.dataset["loading"];
            if (frameStarted) {
                this.postMessageCore(frame, msg);
            } else {
                if (!this.deferredMessages) {
                    this.deferredMessages = [];
                }
                this.deferredMessages.push([frame, msg]);
            }
        }

        private postMessageCore(frame: HTMLIFrameElement, msg: SimulatorMessage) {
            const origin = U.isLocalHostDev() ? "*" : frame.dataset["origin"];
            frame.contentWindow.postMessage(msg, origin);
        }

        private setRunOptionQueryParams(url: string) {
            const urlObject = new URL(url);
            if (this._runOptions?.hideSimButtons) {
                urlObject.searchParams.set("hideSimButtons", "1");
            }

            if (this._runOptions?.queryParameters) {
                const parameters = this._runOptions.queryParameters.split("&");
                for (const param of parameters) {
                    const [a, b] = param.split(/[:=]/);
                    if (a && b) {
                        urlObject.searchParams.set(a, b);
                    }
                }
            }

            return urlObject.toString();
        }

        private createFrame(url?: string): HTMLDivElement {
            const wrapper = document.createElement("div") as HTMLDivElement;
            wrapper.className = `simframe ui embed`;

            const frame = document.createElement('iframe') as HTMLIFrameElement;
            frame.id = 'sim-frame-' + this.nextId()
            frame.title = pxsim.localization.lf("Simulator")
            frame.allowFullscreen = true;
            frame.setAttribute('allow', 'autoplay;microphone');
            frame.setAttribute('sandbox', 'allow-same-origin allow-scripts');
            frame.className = 'no-select';

            let furl = this.setRunOptionQueryParams(url || this.getSimUrl().toString());
            furl += '#' + frame.id;

            frame.src = furl;
            frame.frameBorder = "0";
            frame.dataset['runid'] = this.runId;
            frame.dataset['origin'] = new URL(furl).origin || "*";
            frame.dataset['loading'] = "true";
            if (this._runOptions?.autofocus) frame.setAttribute("autofocus", "true");

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
                frame.focus()
                return false;
            }
            wrapper.appendChild(i);

            const l = document.createElement("div");
            l.className = "ui active loader";
            i.style.display = "none";
            wrapper.appendChild(l);

            if (this._runOptions)
                this.applyAspectRatioToFrame(frame);

            return wrapper;
        }

        public preload(aspectRatio: number, clearRuntime?: boolean) {
            if (clearRuntime) {
                this._currentRuntime = undefined;
                this.container.textContent = "";
            }
            if (!this.simFrames().length) {
                this.container.appendChild(this.createFrame());
                this.applyAspectRatio(aspectRatio);
                this.setStarting();
            }
        }

        public stop(unload = false, starting = false) {
            if (this.state !== SimulatorState.Stopped && this.state !== SimulatorState.Unloaded) {
                this.clearDebugger();
                this.stopSound();
                this.postMessage({ type: 'stop', source: MESSAGE_SOURCE });
                this.setState(starting ? SimulatorState.Starting : SimulatorState.Stopped);
            }
            if (unload)
                this.unload();
        }

        public suspend() {
            this.stopSound();
            this.postMessage({ type: 'stop', source: MESSAGE_SOURCE });
            this.setState(SimulatorState.Suspended);
        }

        private unload() {
            this.cancelFrameCleanup();
            pxsim.U.removeChildren(this.container);
            this.setState(SimulatorState.Unloaded);
            this._runOptions = undefined; // forget about program
            this._currentRuntime = undefined;
            this.runId = undefined;
            this.deferredMessages = undefined;
        }

        public mute(mute: boolean) {
            if (this._currentRuntime)
                this._currentRuntime.mute = mute;
            this.postMessage({ type: 'mute', source: MESSAGE_SOURCE, mute: mute } as pxsim.SimulatorMuteMessage);
        }

        public stopSound() {
            this.postMessage({ type: 'stopsound', source: MESSAGE_SOURCE } as pxsim.SimulatorStopSoundMessage)
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

        private frameCleanupTimeout: any = undefined;
        private cancelFrameCleanup() {
            if (this.frameCleanupTimeout) {
                clearTimeout(this.frameCleanupTimeout);
                this.frameCleanupTimeout = undefined;
            }
        }
        private scheduleFrameCleanup() {
            this.cancelFrameCleanup();
            this.frameCleanupTimeout = setTimeout(() => {
                this.frameCleanupTimeout = undefined;
                this.cleanupFrames();
            }, 5000);
        }

        private applyAspectRatio(ratio?: number) {
            if (!ratio && !this._runOptions) return;
            const frames = this.simFrames();
            frames.forEach(frame => this.applyAspectRatioToFrame(frame, ratio));
        }

        private applyAspectRatioToFrame(frame: HTMLIFrameElement, ratio?: number) {
            let r = ratio;

            // no ratio? try stored ratio
            if (r === undefined) {
                const rt = parseFloat(frame.dataset[FRAME_ASPECT_RATIO])
                if (!isNaN(rt))
                    r = rt;
            }

            // no ratio?, try messagesims
            if (r === undefined) {
                const messageChannel = frame.dataset[FRAME_DATA_MESSAGE_CHANNEL];
                if (messageChannel) {
                    const messageSimulatorAspectRatio = this.options?.messageSimulators?.[messageChannel]?.aspectRatio;
                    if (messageSimulatorAspectRatio) {
                        r = messageSimulatorAspectRatio;
                    }
                }
            }

            // try default from options
            if (r === undefined)
                r = this._runOptions?.aspectRatio || 1.22;

            // apply to css
            frame.parentElement.style.paddingBottom =
                (100 / r) + "%";
        }

        private cleanupFrames() {
            // drop unused extras frames after 5 seconds
            const frames = this.simFrames(true);
            frames.shift(); // drop first frame
            frames.filter(frame => !frame.dataset[PERMANENT])
                .forEach(frame => {
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

        public setRunOptions(opts: SimulatorRunOptions = {}) {
            this._runOptions = opts;
        }

        public run(js: string, opts: SimulatorRunOptions = {}) {
            this.setRunOptions(opts);
            this.runId = this.nextId();
            // store information
            this._currentRuntime = {
                type: "run",
                source: MESSAGE_SOURCE,
                boardDefinition: opts.boardDefinition,
                parts: opts.parts,
                builtinParts: opts.builtinParts,
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
                clickTrigger: opts.clickTrigger,
                breakOnStart: opts.breakOnStart,
                storedState: opts.storedState,
                ipc: opts.ipc,
                single: opts.single,
                dependencies: opts.dependencies,
                activePlayer: opts.activePlayer,
                theme: opts.theme,
            }
            this.stopSound();
            this.start();
        }

        public restart() {
            this.stop();
            this.cleanupFrames();
            this.start();
        }

        public areBreakpointsSet() {
            return this.breakpointsSet;
        }

        private start() {
            this.clearDebugger();
            this.addEventListeners();
            this.applyAspectRatio();
            this.scheduleFrameCleanup();

            if (!this._currentRuntime) return; // nothing to do

            this.breakpointsSet = false;

            // first frame
            let frame = this.simFrames()[0];
            if (!frame) {
                let wrapper = this.createFrame();
                this.container.appendChild(wrapper);
                frame = wrapper.firstElementChild as HTMLIFrameElement;
            } else // reuse simulator
                this.startFrame(frame);

            this.debuggingFrame = frame.id;

            this.setState(SimulatorState.Running);
            this.setTraceInterval(this.traceInterval);
        }

        // ensure _currentRuntime is ready
        private startFrame(frame: HTMLIFrameElement): boolean {
            if (!this._currentRuntime || !frame.contentWindow) return false;
            const msg = JSON.parse(JSON.stringify(this._currentRuntime)) as pxsim.SimulatorRunMessage;
            msg.frameCounter = ++this.frameCounter;
            const mpRole = this._runOptions?.mpRole || /[\&\?]mp=(server|client)/i.exec(window.location.href)?.[1]?.toLowerCase();
            msg.options = {
                theme: this.themes[this.nextFrameId++ % this.themes.length],
                mpRole
            };

            msg.id = `${msg.options.theme}-${this.nextId()}`;
            frame.dataset['runid'] = this.runId;
            frame.dataset['runtimeid'] = msg.id;
            if (frame.id !== this.debuggingFrame) {
                msg.traceDisabled = true;
                msg.breakOnStart = false;
            }
            this.postMessageCore(frame, msg);
            if (this.traceInterval) this.setTraceInterval(this.traceInterval);
            this.applyAspectRatioToFrame(frame);
            this.setFrameState(frame);
            return true;
        }

        private handleDeferredMessages(frame: HTMLIFrameElement) {
            if (frame.dataset["loading"]) {
                delete frame.dataset["loading"];
                this.deferredMessages
                    ?.filter(defMsg => defMsg[0] === frame)
                    ?.forEach(defMsg => {
                        const [_, msg] = defMsg;
                        this.postMessageCore(frame, msg);
                    });
                this.deferredMessages = this.deferredMessages?.filter(defMsg => defMsg[0] !== frame);
            }
        }

        private handleMessage(msg: pxsim.SimulatorMessage, source?: Window) {
            switch (msg.type || '') {
                case 'ready': {
                    const frameid = (msg as pxsim.SimulatorReadyMessage).frameid;
                    const frame = document.getElementById(frameid) as HTMLIFrameElement;
                    if (frame) {
                        if (this._runOptions?.autofocus)
                            frame.focus();
                        this.startFrame(frame);
                        if (this.options.revealElement)
                            this.options.revealElement(frame);
                        this.handleDeferredMessages(frame);
                    }
                    if (this.options.onSimulatorReady)
                        this.options.onSimulatorReady();
                    break;
                }
                case 'status': {
                    const frameid = (msg as pxsim.SimulatorReadyMessage).frameid;
                    const frame = document.getElementById(frameid) as HTMLIFrameElement;
                    if (frame) {
                        const stmsg = msg as SimulatorStateMessage;
                        if (stmsg.runtimeid == frame.dataset['runtimeid']) {
                            switch (stmsg.state) {
                                case "running":
                                    this.setState(SimulatorState.Running);
                                    this.handleDeferredMessages(frame);
                                    break;
                                case "killed":
                                    this.setState(SimulatorState.Stopped);
                                    break;
                            }
                        }
                    }
                    break;
                }
                case 'simulator':
                    this.handleSimulatorCommand(msg as pxsim.SimulatorCommandMessage); break; //handled elsewhere
                case 'serial':
                case 'pxteditor':
                case 'screenshot':
                case 'custom':
                case 'recorder':
                case 'addextensions':
                    break; //handled elsewhere
                case 'aspectratio': {
                    const asmsg = msg as SimulatorAspectRatioMessage;
                    const frameid = asmsg.frameid;
                    const frame = document.getElementById(frameid) as HTMLIFrameElement;
                    if (frame) {
                        frame.dataset[FRAME_ASPECT_RATIO] = asmsg.value + "";
                        this.applyAspectRatioToFrame(frame);
                    }
                    break;
                }
                case 'debugger': this.handleDebuggerMessage(msg as DebuggerMessage); break;
                case 'toplevelcodefinished': if (this.options.onTopLevelCodeEnd) this.options.onTopLevelCodeEnd(); break;
                case 'setmutebuttonstate': this.options.onMuteButtonStateChange?.((msg as SetMuteButtonStateMessage).state); break;
                default:
                    this.postMessage(msg, source);
                    break;
            }
        }

        private addEventListeners() {
            if (!this.listener) {
                this.listener = (ev: MessageEvent) => {
                    if (this.hwdbg) return

                    if (U.isLocalHost()) {
                        // no-op
                    } else {
                        if (this._allowedOrigins.indexOf(ev.origin) < 0)
                            return
                    }
                    this.handleMessage(ev.data, ev.source as Window)
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

            this.postMessage({ type: 'debugger', subtype: msg, source: MESSAGE_SOURCE } as pxsim.DebuggerMessage);
        }

        public setBreakpoints(breakPoints: number[]) {
            this.breakpointsSet = true;
            this.postDebuggerMessage("config", { setBreakpoints: breakPoints }, undefined, this.debuggingFrame);
        }

        public setTraceInterval(intervalMs: number) {
            this.traceInterval = intervalMs;
            // Send to all frames so that they all run at the same speed, even though only the debugging sim
            // will actually send events
            this.postDebuggerMessage("traceConfig", { interval: intervalMs });
        }

        public variablesAsync(id: number, fields?: string[]): Promise<VariablesMessage> {
            return this.postDebuggerMessageAsync("variables", { variablesReference: id, fields: fields } as DebugProtocol.VariablesArguments, this.debuggingFrame)
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
                case "breakpoint": {
                    const brk = msg as pxsim.DebuggerBreakpointMessage
                    if (this.state == SimulatorState.Running) {
                        if (brk.exceptionMessage) {
                            this.suspend();
                        }
                        else {
                            this.setState(SimulatorState.Paused);
                            const frames = this.simFrames(true);
                            if (frames.length > 1) {
                                // Make sure all frames pause
                                this.resume(SimulatorDebuggerCommand.Pause);
                            }
                        }

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
                }
                case "trace": {
                    const brk = msg as pxsim.DebuggerBreakpointMessage
                    if (this.state == SimulatorState.Running && this.options.onTraceMessage) {
                        this.options.onTraceMessage(brk);
                    }
                    break;
                }
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

        private postDebuggerMessageAsync(subtype: string, data: any = {}, frameID: string): Promise<DebuggerMessage> {
            return new Promise((resolve, reject) => {
                const seq = this.debuggerSeq++;
                this.debuggerResolvers[seq.toString()] = { resolve, reject };
                this.postDebuggerMessage(subtype, data, seq, frameID);
            })
        }

        private postDebuggerMessage(subtype: string, data: any = {}, seq?: number, frameID?: string) {
            const msg: pxsim.DebuggerMessage = JSON.parse(JSON.stringify(data))
            msg.type = "debugger"
            msg.subtype = subtype;
            msg.source = MESSAGE_SOURCE;
            if (seq)
                msg.seq = seq;
            this.postMessage(msg, undefined, frameID);
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
