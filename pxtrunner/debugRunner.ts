namespace pxt.runner {
    /**
     * Starts the simulator and injects it into the provided container.
     * the simulator will attempt to establish a websocket connection
     * to the debugger's user interface on port 3234.
     *
     * @param container The container to inject the simulator into
     */
    export function startDebuggerAsync(container: HTMLElement) {
        const debugRunner = new DebugRunner(container);
        debugRunner.start();
    }

    /**
     * Runner messages are specific to the debugger host and not part
     * of the debug protocol. They contain file system requests and other
     * information for the server-side runner.
     */
    interface RunnerMessage extends DebugProtocol.ProtocolMessage {
        type: "runner";
        subtype: string;
    }

    /**
     * Message that indicates that the simulator is ready to run code.
     */
    interface ReadyMessage extends RunnerMessage {
        subtype: "ready";
    }


    /**
     * Message containing code and debug information for simulator
     */
    interface RunCodeMessage extends RunnerMessage {
        subtype: "runcode";
        code: string;
        usedParts: string[];
        usedArguments: Map<string>;
        breakpoints: pxtc.Breakpoint[];
    }

    /**
     * Runner for the debugger that handles communication with the user
     * interface. Also talks to the server for anything to do with
     * the filesystem (like reading code)
     */
    export class DebugRunner implements pxsim.protocol.DebugSessionHost {
        private static RETRY_MS = 2500;

        private session: pxsim.SimDebugSession;
        private ws: WebSocket;
        private pkgLoaded = false;

        private dataListener: (msg: DebugProtocol.ProtocolMessage) => void;
        private errorListener: (msg: string) => void;
        private closeListener: () => void;

        private intervalId: number;
        private intervalRunning = false;

        constructor(private container: HTMLElement) {}

        public start() {

            this.initializeWebsocket();

            if (!this.intervalRunning) {
                this.intervalRunning = true;
                this.intervalId = setInterval(() => {
                    if (!this.ws) {
                        try {
                            this.initializeWebsocket();
                        }
                        catch (e) {
                            console.warn(`Connection to server failed, retrying in ${DebugRunner.RETRY_MS} ms`);
                        }
                    }
                }, DebugRunner.RETRY_MS);
            }

            this.session = new pxsim.SimDebugSession(this.container);
            this.session.start(this);
        }

        private initializeWebsocket() {
            if (!pxt.BrowserUtils.isLocalHost() || !Cloud.localToken)
            return;

            pxt.debug('initializing debug pipe');
            this.ws = new WebSocket('ws://localhost:3234/' + Cloud.localToken + '/simdebug');

            this.ws.onopen = ev => {
                pxt.debug('debug: socket opened');
            }

            this.ws.onclose = ev => {
                pxt.debug('debug: socket closed')

                if (this.closeListener) {
                    this.closeListener();
                }

                this.session.stopSimulator();

                this.ws = undefined;
            }

            this.ws.onerror = ev => {
                pxt.debug('debug: socket closed due to error')

                if (this.errorListener) {
                    this.errorListener(ev.type);
                }

                this.session.stopSimulator();

                this.ws = undefined;
            }

            this.ws.onmessage = ev => {
                let message: DebugProtocol.ProtocolMessage;

                try {
                    message = JSON.parse(ev.data);
                } catch (e) {
                    pxt.debug('debug: could not parse message')
                }

                if (message) {
                    // FIXME: ideally, we should just open two websockets instead of adding to the
                    // debug protocol. One for the debugger, one for meta-information and file
                    // system requests
                    if (message.type === 'runner') {
                        this.handleRunnerMessage(message as RunnerMessage);
                    }
                    else {
                        // Intercept the launch configuration and notify the server-side debug runner
                        if (message.type === "request" && (message as DebugProtocol.Request).command === "launch") {
                            this.sendRunnerMessage("configure", {
                                projectDir: (message as any).arguments.projectDir
                            });
                        }
                        this.dataListener(message);
                    }
                }
            }
        }

        public send(msg: string): void {
            this.ws.send(msg);
        }

        public onData(cb: (msg: DebugProtocol.ProtocolMessage) => void): void {
            this.dataListener = cb;
        }

        public onError(cb: (e?: any) =>  void): void {
            this.errorListener = cb;
        }

        public onClose(cb: () => void): void {
            this.closeListener = cb;
        }

        public close(): void {
            if (this.session) {
                this.session.stopSimulator(true);
            }

            if (this.intervalRunning) {
                clearInterval(this.intervalId);
                this.intervalId = undefined;
            }

            if (this.ws) {
                this.ws.close();
            }
        }

        private handleRunnerMessage(msg: RunnerMessage) {
            switch (msg.subtype) {
                case "ready":
                    this.sendRunnerMessage("ready");
                    break;
                case "runcode":
                    this.runCode(msg as RunCodeMessage);
                    break;
            }
        }

        private runCode(msg: RunCodeMessage) {
            const breakpoints: [number, DebugProtocol.Breakpoint][] = [];

            // The breakpoints are in the format returned by the compiler
            // and need to be converted to the format used by the DebugProtocol
            msg.breakpoints.forEach(bp => {
                breakpoints.push([bp.id, {
                    verified: true,
                    line: bp.line,
                    column: bp.column,
                    endLine: bp.endLine,
                    endColumn: bp.endColumn,
                    source: {
                        path: bp.fileName
                    }
                }]);
            });

            this.session.runCode(msg.code, msg.usedParts, msg.usedArguments, new pxsim.BreakpointMap(breakpoints), pxt.appTarget.simulator.boardDefinition);
        }

        private sendRunnerMessage(subtype: string, msg: Map<string> = {}) {
            msg["subtype"] = subtype;
            msg["type"] = "runner";
            this.send(JSON.stringify(msg));
        }
    }
}