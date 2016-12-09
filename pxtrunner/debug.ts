namespace pxt.runner {
    export function startDebuggerAsync(container: HTMLElement) {
        const debugRunner = new DebugRunner(container);
    }

    /**
     * PXT-Specific messages for controlling the simulator and updating the code being debugged
     */
    export interface RunnerMessage extends DebugProtocol.ProtocolMessage {
        type: "runner";
        subtype: string;
    }

    export interface ReadyMessage extends RunnerMessage {
        subtype: "ready";
    }

    export interface RunCodeMessage extends RunnerMessage {
        subtype: "runcode";
        code: string;
        usedParts: string[];
        usedArguments: { [index: string]: string };
        breakpoints: pxtc.Breakpoint[];
    }

    export class DebugRunner implements pxsim.debug.DebugSessionHost {
        private session: pxsim.debug.SimDebugSession;
        private ws: WebSocket;
        private pkgLoaded = false;

        private dataListener: (msg: DebugProtocol.ProtocolMessage) => void;
        private errorListener: (msg: string) => void;
        private closeListener: () => void;

        constructor(container: HTMLElement) {
            this.initializeWebsocket();
            this.session = new pxsim.debug.SimDebugSession(container);
            this.session.start(this);
        }

        private initializeWebsocket() {
            if (!pxt.appTarget.serial || !/^http:\/\/localhost/i.test(window.location.href) || !Cloud.localToken)
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

                this.ws = undefined;
            }

            this.ws.onerror = ev => {
                pxt.debug('debug: socket closed due to error')

                if (this.errorListener) {
                    this.errorListener(ev.type);
                }

                this.ws = undefined;
            }

            this.ws.onmessage = ev => {
                let message: DebugProtocol.ProtocolMessage;

                try {
                    message = JSON.parse(ev.data);
                } catch(e) {
                    pxt.debug('debug: could not parse message')
                }

                if (message) {
                    if (message.type === 'runner') {
                        this.handleMessage(message as RunnerMessage);
                    }
                    else {
                        if (message.type === "request" && (message as DebugProtocol.Request).command === "launch") {
                            // Build happens on the server side
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

        }

        private handleMessage(msg: RunnerMessage) {
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
            // and need to be converted to debug protocol
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

        private sendRunnerMessage(subtype: string, msg: {[index: string]: string} = {}) {
            msg["subtype"] = subtype;
            msg["type"] = "runner";
            this.send(JSON.stringify(msg));
        }
    }
}