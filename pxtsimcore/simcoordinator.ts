namespace pxsim {
    /** Something the coordinator can post a message to, such as another editor window. */
    export interface SimMessageTarget {
        postMessage(message: any, targetOrigin: string): void;
    }

    /** What the coordinator needs to know about the page or process that hosts it. */
    export interface SimEnvironment {
        /** The origin of the editor. */
        readonly origin: string;
        /** The editor's URL, including the query string. */
        href(): string;
        /** The window that embeds or opened the editor, if any. */
        parentTarget(): SimMessageTarget | undefined;
        /** False once a registered dependent editor has gone away. */
        isTargetAlive(target: SimMessageTarget): boolean;
        /** The simulator URL from the page's configuration, if it has one. */
        configuredSimUrl(): string | undefined;
        /** Listens for messages from simulators and other editors. Returns the function that stops listening. */
        addMessageListener(listener: (origin: string, data: any, source: unknown) => void): () => void;
    }

    export interface SimulatorCoordinatorOptions {
        restart?: () => void; // restart simulator
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
        // `messageSimulators` is @DEPRECATED. Use `simulatorExtensions` instead.
        messageSimulators?: pxt.Map<{
            url: string;
            localHostUrl?: string;
            aspectRatio?: number;
            permanent?: boolean;
        }>;
        // Simulator extensions read from targetconfig.json's `approvedRepoLib` entry.
        simulatorExtensions?: pxt.Map<{
            // Fields from pxt.SimulatorExtensionConfig
            aspectRatio?: number;
            permanent?: boolean;
            index?: string;
            devUrl?: string;
            // Additional fields outside of pxt.SimulatorExtensionConfig
            url?: string; // Computed URL
        }>;
        // needed when simulatorExtensions are used to provide to their frame
        userLanguage?: string;
    }

    const MESSAGE_SOURCE = "pxtdriver"

    export class SimulatorCoordinator {
        private themes = ["blue", "red", "green", "yellow"];
        private runId = '';
        private nextFrameId = 0;
        private frameCounter = 0;
        private singleSimulator = false;
        private _currentRuntime: pxsim.SimulatorRunMessage;
        private stopListening: () => void;
        private traceInterval = 0;
        private breakpointsSet = false;
        private _runOptions: SimulatorRunOptions = {};
        public state = SimulatorState.Unloaded;
        public hwdbg: HwDebugger;
        private _dependentEditors: SimMessageTarget[];
        private _allowedOrigins: string[] = [];
        private debuggingFrame: string;

        constructor(protected frameHost: SimFrameHost,
            protected env: SimEnvironment,
            public options: SimulatorCoordinatorOptions = {}) {

            this._allowedOrigins.push(env.origin);
            if (options.parentOrigin) {
                this._allowedOrigins.push(options.parentOrigin)
            }

            this._allowedOrigins.push(this.getSimUrl().origin);

            // Legacy support for message simulators
            const messageSimulators = options?.messageSimulators || {};
            Object.keys(messageSimulators)
                .map(channel => messageSimulators[channel])
                .forEach(messageSimulator => {
                    this._allowedOrigins.push(new URL(messageSimulator.url).origin);
                    if (messageSimulator.localHostUrl)
                        this._allowedOrigins.push(new URL(messageSimulator.localHostUrl).origin);
                });

            // Preprocess simulator extensions
            const simXDevMode = U.isLocalHost() && /[?&]simxdev(?:[=&#]|$)/i.test(env.href());
            Object.entries(options?.simulatorExtensions || {}).forEach(([key, simx]) => {
                // Verify essential `simx` config was provided
                if (
                    !simx ||
                    !simx.index ||
                    !simx.aspectRatio ||
                    simx.permanent === undefined
                ) {
                    return;
                }
                // Compute the effective URL
                if (simXDevMode && simx.devUrl) {
                    // Use the dev URL if the dev flag is set (and we're on localhost)
                    simx.url = new URL(simx.index, simx.devUrl).toString();
                } else {
                    const simUrl = this.getSimUrl();
                    // Construct the path. The "-" element delineates the extension key from the resource name.
                    const simxPath = ["simx", key, "-", simx.index].join("/");
                    // Create the fully-qualified URL, preserving the origin by removing all leading slashes
                    simx.url = new URL(simxPath.replace(/^\/+/, ""), simUrl.origin).toString();
                }

                // Add the origin to the allowed origins
                this._allowedOrigins.push(new URL(simx.url).origin);
            });

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
            const frame = this.mainFrame();
            if (frame) frame.focus();
        }

        registerDependentEditor(w: SimMessageTarget) {
            if (!w) return;
            if (!this._dependentEditors)
                this._dependentEditors = [];
            this._dependentEditors.push(w);
        }

        private dependentEditors() {
            if (this._dependentEditors) {
                this._dependentEditors = this._dependentEditors.filter(w => this.env.isTargetAlive(w))
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
                this.frameHost.setDimmed(true)
            } else {
                this.frameHost.setDimmed(false)
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
            const frame = this.mainFrame();
            if (!frame) return undefined;

            this.postMessage(<SimulatorRecorderMessage>{
                type: 'recorder',
                action: 'start',
                source: MESSAGE_SOURCE,
                width
            }, undefined, frame.id);
        }

        public stopRecording() {
            this.postMessage(<SimulatorRecorderMessage>{ type: 'recorder', source: MESSAGE_SOURCE, action: 'stop' })
        }

        private setFrameState(frame: SimFrame) {
            const autoRun = !!(this._runOptions && this._runOptions.autoRun);
            this.frameHost.setFrameAppearance(frame, this.state, {
                autoRun,
                stoppedClass: this.stoppedClass,
                invalidatedClass: this.invalidatedClass
            });
            if (this.state == SimulatorState.Stopped || this.state == SimulatorState.Suspended)
                this.scheduleFrameCleanup();
        }

        private setState(state: SimulatorState) {
            if (this.state != state) {
                this.state = state;
                this.frameHost.freeze(this.state == SimulatorState.Paused); // don't allow interaction when pause
                this.simFrames().forEach(frame => this.setFrameState(frame));
                if (this.options.onStateChanged)
                    this.options.onStateChanged(this.state);
            }
        }

        private simFrames(skipLoaned = false): SimFrame[] {
            return this.frameHost.frames(skipLoaned);
        }

        /**
         * Returns the main simulator frame: the first frame not running a
         * simulator extension, or undefined when there is none.
         * @param skipLoaned excludes the loaned simulator's frame, as `simFrames` does
         */
        private mainFrame(skipLoaned = false): SimFrame {
            return this.simFrames(skipLoaned).find(frame => !frame.messageChannel);
        }

        private getSimUrl(): URL {
            const simUrl = this.options.simUrl || this.env.configuredSimUrl() || `${this.env.origin}/sim/simulator.html`;
            try {
                return new URL(simUrl);
            } catch {
                // Failed to parse set url; try based off origin in case path defined as relative (e.g. /simulator.html)
                return new URL(simUrl, this.env.origin);
            }
        }

        public setSingleSimulator(){
            this.singleSimulator = true
        }

        public postMessage(msg: pxsim.SimulatorMessage, source?: unknown, frameID?: string) {
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
                const mkcdFrames = frames.filter(frame => !frame.messageChannel);
                const messageChannel = msg.type === "messagepacket" && (msg as SimulatorControlMessage).channel;
                // include index of the source iframe
                broadcastmsg.srcFrameIndex = this.simFrames().findIndex((item) => item.matchesSource(source));
                const sourceFrame = broadcastmsg.srcFrameIndex >= 0 ? this.simFrames()[broadcastmsg.srcFrameIndex] : undefined;
                // jacdac messages from a board sim other than the main frame should be dropped
                if (sourceFrame !== this.mainFrame() && mkcdFrames.find(f => f === sourceFrame) && messageChannel === "jacdac")
                    return;
                // if the editor is hosted in a multi-editor setting
                // don't start extra frames
                const single = !!this._currentRuntime?.single;
                const parentWindow = this.env.parentTarget();
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
                                w.postMessage(msg, this.env.origin)
                        })
                        // start second simulator
                    } else if (!single) {
                        const messageSimulator = messageChannel &&
                            this.options.messageSimulators &&
                            this.options.messageSimulators[messageChannel];
                        const simulatorExtension = messageChannel &&
                            this.options.simulatorExtensions &&
                            this.options.simulatorExtensions[messageChannel];

                        const startSimulatorExtension = (url: string, permanent: boolean, aspectRatio: number) => {
                            aspectRatio = aspectRatio || this._runOptions?.aspectRatio || 1.22;
                            const messageFrame = this.createFrame("last", url,
                                ["simmsg", "simmsg" + U.sanitizeCssName(messageChannel)]);
                            messageFrame.messageChannel = messageChannel;
                            messageFrame.aspectRatio = aspectRatio;
                            if (permanent)
                                messageFrame.permanent = true;
                            this.startFrame(messageFrame);
                            frames = this.simFrames(); // refresh
                        }
                        // should we start a simulator extension for this message?
                        if (simulatorExtension) {
                            // find a frame already running that simulator
                            let messageFrame = frames.find(frame => frame.messageChannel === messageChannel);
                            // not found, spin a new one
                            if (!messageFrame) {
                                const url = new URL(simulatorExtension.url);
                                // The extension's parent window is this editor, so the origin it
                                // should trust is the editor's own. options.parentOrigin is the
                                // editor's *embedder* origin (controller mode) - the extension's
                                // grandparent - so an extension that validates messages against
                                // it rejects everything the editor sends when the editor is
                                // embedded cross-origin.
                                // searchParams.set() encodes, so don't encode the values here.
                                url.searchParams.set("parentOrigin", this.env.origin);
                                if (this.options.userLanguage)
                                    url.searchParams.set("language", this.options.userLanguage);
                                startSimulatorExtension(url.toString(), simulatorExtension.permanent, simulatorExtension.aspectRatio);
                            }
                            // not running the current run, restart
                            else if (messageFrame.runId != this.runId) {
                                this.startFrame(messageFrame);
                            }
                        }
                        // (legacy: messageSimulator) should we start a message simulator for this message?
                        else if (messageSimulator) {
                            // find a frame already running that simulator
                            let messageFrame = frames.find(frame => frame.messageChannel === messageChannel);
                            // not found, spin a new one
                            if (!messageFrame) {
                                const useLocalHost = U.isLocalHost() && /localhostmessagesims=1/i.test(this.env.href())
                                const url = ((useLocalHost && messageSimulator.localHostUrl) || messageSimulator.url)
                                    .replace("$PARENT_ORIGIN$", encodeURIComponent(this.options.parentOrigin || ""))
                                    .replace("$LANGUAGE$", encodeURIComponent(this.options.userLanguage))
                                startSimulatorExtension(url, messageSimulator.permanent, messageSimulator.aspectRatio);
                            }
                            // not running the curren run, restart
                            else if (messageFrame.runId != this.runId) {
                                this.startFrame(messageFrame);
                            }
                        } else {
                            isDeferrableBroadcastMessage = true;
                            // start secondary frame if needed
                            if (!messageChannel &&
                                    (mkcdFrames.length == 0 || mkcdFrames.length == 1 && !this.singleSimulator)) {
                                // messageChannel is set to false whenever msg.type !== "messagepacket"
                                // for example, in the case of msg.type === "radiopacket". However, in the case
                                // where we have msg.type === "messagepacket" and msg.channel is not matched by an
                                // extension, we don't want a second simulator to be created. 
                                this.createFrame("last");
                                frames = this.simFrames();
                                // there might be an old frame
                            } else if (mkcdFrames.length == 2 && mkcdFrames[1].runId != this.runId) {
                                this.startFrame(mkcdFrames[1]);
                            }
                        }
                    }
                }
            }

            // now that we have iframe starts,
            // dispatch message to other frames
            const mainFrame = this.mainFrame();
            for (let i = 0; i < frames.length; ++i) {
                const frame = frames[i];
                // same frame as source
                if (source && frame.matchesSource(source)) continue;
                // if jacdac message, don't send to (board) simulator frames other than the main frame
                if (frame !== mainFrame && !frame.messageChannel &&
                    msg.type === "messagepacket" && (msg as pxsim.SimulatorControlMessage).channel === "jacdac") continue;
                // frame not in DOM
                if (!frame.attached) continue;

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

        protected deferredMessages: [SimFrame, SimulatorMessage][];
        protected postDeferrableMessage(frame: SimFrame, msg: SimulatorMessage) {
            const frameStarted = !frame.loading;
            if (frameStarted) {
                this.postMessageCore(frame, msg);
            } else {
                if (!this.deferredMessages) {
                    this.deferredMessages = [];
                }
                this.deferredMessages.push([frame, msg]);
            }
        }

        private postMessageCore(frame: SimFrame, msg: SimulatorMessage) {
            this.frameHost.post(frame, msg);
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

        protected createFrame(position: SimFramePosition, url?: string, wrapperClasses?: string[]): SimFrame {
            const id = 'sim-frame-' + this.nextId();
            const furl = this.setRunOptionQueryParams(url || this.getSimUrl().toString()) + '#' + id;

            const frame = this.frameHost.createFrame({
                id,
                url: furl,
                origin: new URL(furl).origin || "*",
                runId: this.runId,
                autofocus: !!this._runOptions?.autofocus,
                wrapperClasses,
                onPlayClick: () => {
                    if (this.state != SimulatorState.Running
                        && this.state != SimulatorState.Starting) {
                        // we need to request to restart the simulator
                        if (this.options.restart)
                            this.options.restart();
                        else
                            this.start();
                    }
                }
            }, position);

            if (this._runOptions)
                this.applyAspectRatioToFrame(frame);

            return frame;
        }

        public preload(aspectRatio: number, clearRuntime?: boolean) {
            this.addEventListeners();
            if (clearRuntime) {
                this._currentRuntime = undefined;
                this.frameHost.removeAllFrames();
            }
            if (!this.mainFrame()) {
                const frame = this.createFrame("first");
                this.applyAspectRatioToFrame(frame, aspectRatio);
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
            this.frameHost.removeAllFrames();
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

        private applyAspectRatioToFrame(frame: SimFrame, ratio?: number) {
            let r = ratio;

            // no ratio? try stored ratio
            if (r === undefined) {
                r = frame.aspectRatio;
            }

            // no ratio?, try messagesims
            if (r === undefined) {
                const messageChannel = frame.messageChannel;
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
            this.frameHost.setAspectRatio(frame, r);
        }

        private cleanupFrames() {
            // drop unused extras frames after 5 seconds
            const mainFrame = this.mainFrame(true);
            const frames = this.simFrames(true).filter(frame => frame !== mainFrame);
            frames.filter(frame => !frame.permanent)
                .forEach(frame => {
                    if (this.state == SimulatorState.Stopped
                        || frame.runId != this.runId) {
                        this.frameHost.removeFrame(frame);
                    }
                });
        }

        public hide(completeHandler?: () => void) {
            this.suspend();
            if (!this.frameHost.canRemoveFrames) return;

            const frames = this.simFrames();
            frames.forEach(frame => {
                if (frame.permanent && this.frameHost.canHideFrames)
                    this.frameHost.hideFrame(frame, completeHandler);
                else
                    this.frameHost.removeFrame(frame, completeHandler);
            });
            // Execute the complete handler if there are no frames in sim view
            if (frames.length == 0 && completeHandler) {
                completeHandler();
            }
        }

        public unhide() {
            if (!this.frameHost.canUnhideFrames) return;

            this.simFrames().forEach(frame => this.frameHost.unhideFrame(frame));
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

            this.singleSimulator = false;
            this.breakpointsSet = false;

            // first frame
            let frame = this.mainFrame();
            if (!frame) {
                frame = this.createFrame("first");
            }
            this.startFrame(frame);

            this.debuggingFrame = frame.id;

            this.setState(SimulatorState.Running);
            this.setTraceInterval(this.traceInterval);
        }

        // ensure _currentRuntime is ready
        private startFrame(frame: SimFrame): boolean {
            if (!this._currentRuntime || !frame.attached) return false;
            const msg = JSON.parse(JSON.stringify(this._currentRuntime)) as pxsim.SimulatorRunMessage;
            msg.frameCounter = ++this.frameCounter;
            const mpRole = this._runOptions?.mpRole || /[\&\?]mp=(server|client)/i.exec(this.env.href())?.[1]?.toLowerCase();
            msg.options = {
                theme: this.themes[this.nextFrameId++ % this.themes.length],
                mpRole
            };

            msg.id = `${msg.options.theme}-${this.nextId()}`;
            frame.runId = this.runId;
            frame.runtimeId = msg.id;
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

        private handleDeferredMessages(frame: SimFrame) {
            if (frame.loading) {
                frame.loading = false;
                this.deferredMessages
                    ?.filter(defMsg => defMsg[0] === frame)
                    ?.forEach(defMsg => {
                        const [_, msg] = defMsg;
                        this.postMessageCore(frame, msg);
                    });
                this.deferredMessages = this.deferredMessages?.filter(defMsg => defMsg[0] !== frame);
            }
        }

        private handleMessage(msg: pxsim.SimulatorMessage, source?: unknown) {
            switch (msg.type || '') {
                case 'ready': {
                    const frameid = (msg as pxsim.SimulatorReadyMessage).frameid;
                    const frame = this.frameHost.frameById(frameid);
                    if (frame) {
                        if (this._runOptions?.autofocus)
                            frame.focus();
                        this.startFrame(frame);
                        this.frameHost.revealFrame(frame);
                        this.handleDeferredMessages(frame);
                    }
                    if (this.options.onSimulatorReady)
                        this.options.onSimulatorReady();
                    break;
                }
                case 'status': {
                    const frameid = (msg as pxsim.SimulatorReadyMessage).frameid;
                    const frame = this.frameHost.frameById(frameid);
                    if (frame) {
                        const stmsg = msg as SimulatorStateMessage;
                        if (stmsg.runtimeid == frame.runtimeId) {
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
                    const frame = this.frameHost.frameById(frameid);
                    if (frame) {
                        frame.aspectRatio = asmsg.value;
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
            if (!this.stopListening) {
                this.stopListening = this.env.addMessageListener((origin, data, source) => {
                    if (this.hwdbg) return

                    if (U.isLocalHost()) {
                        // no-op
                    } else {
                        if (this._allowedOrigins.indexOf(origin) < 0)
                            return
                    }
                    this.handleMessage(data, source)
                });
            }
        }

        private removeEventListeners() {
            if (this.stopListening) {
                this.stopListening();
                this.stopListening = undefined;
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
                    pxsim.debug('unknown command')
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

        public variablesAsync(id: number, fields?: string[], includeAll = false): Promise<VariablesMessage> {
            return this.postDebuggerMessageAsync("variables", { variablesReference: id, fields: fields, includeAll } as DebugProtocol.VariablesArguments, this.debuggingFrame)
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
                pxsim.log("DBG-MSG", msg.subtype, msg)
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
                        if (brk.exceptionMessage) pxsim.error(stackTrace);
                    } else {
                        pxsim.error("debugger: trying to pause from " + this.state);
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
