/// <reference path="./protocol.d.ts" />

namespace pxt.runner {

    export function startDebuggerAsync(container: HTMLElement) {
        const debugRunner = new DebugRunner(container);
    }


    export class DebugRunner {
        private driver: pxsim.SimulatorDriver;
        private ws: WebSocket;
        private pkgLoaded = false;

        constructor(container: HTMLElement) {
            let options: pxsim.SimulatorDriverOptions = {
                onDebuggerBreakpoint: b => this.onDebuggerBreakpoint(b),
                onDebuggerWarning: w => this.onDebuggerWarning(w),
                onDebuggerResume: () => this.onDebuggerResume(),
                onStateChanged: s => this.onStateChanged(s)
            };

            this.driver = new pxsim.SimulatorDriver(container, options);

            this.initializeWebsocket();
        }

        private initializeWebsocket() {
            if (!pxt.appTarget.serial || !/^http:\/\/localhost/i.test(window.location.href) || !Cloud.localToken)
            return;

            pxt.debug('initializing debug pipe');
            this.ws = new WebSocket('ws://localhost:3234/' + Cloud.localToken + '/simdebug');

            this.ws.onopen = (ev) => {
                pxt.debug('debug: socket opened');
                this.trySendMessage({ type: "ready" });
            }

            this.ws.onclose = (ev) => {
                pxt.debug('debug: socket closed')
                this.ws = undefined;
            }

            this.ws.onerror = (ev) => {
                pxt.debug('debug: socket closed due to error')
                this.ws = undefined;
            }

            this.ws.onmessage = (ev) => {
                const m = parseMessage(ev.data);
                if (m && m.type) {
                    this.handleMessage(m);
                }
            }
        }

        private runCode(m: Commands.Sim.CompiledJsInfo) {
            if (m.code) {
                const runOptions: pxsim.SimulatorRunOptions = {
                    boardDefinition: pxt.appTarget.simulator.boardDefinition,
                    parts: m.usedParts,
                    fnArgs: m.usedArguments
                };

                if (pxt.appTarget.simulator) {
                    runOptions.aspectRatio = m.usedParts.length && pxt.appTarget.simulator.partsAspectRatio
                        ? pxt.appTarget.simulator.partsAspectRatio
                        : pxt.appTarget.simulator.aspectRatio;
                }

                this.driver.run(m.code, runOptions);
            }
            else {
                this.driver.stop();
            }
        }

        private handleMessage(m: SimulatorMessage) {
            switch (m.type) {
                case "ready":
                    if (this.pkgLoaded) {
                        this.trySendMessage({ type: "ready" });
                    }
                    break;
                case "setcode":
                    this.runCode(m as Commands.Sim.SetCodeMessage);
                    break;
                case "debugger":
                    this.handleDebuggerMessage(m as DebuggerMessage);
                    break;
            }
        }

        private handleDebuggerMessage(m: DebuggerMessage) {
            switch (m.subtype) {
                case "config":
                    const configMsg = m as Commands.Debug.DebuggerConfigMessage;
                    this.driver.setBreakpoints(configMsg.setBreakpoints);
                    this.trySendDebugResponse("breakpointsset", configMsg.messageId);
                    break;
            }
        }

        private trySendDebugResponse(subtype: string, id: number): boolean {
            if (id !== undefined) {
                return this.trySendMessage({
                    type: "debugger",
                    messageId: id,
                    subtype
                } as DebuggerMessage);
            }

            return false;
        }

        private trySendMessage(msg: SimulatorMessage): boolean {
            if (!this.ws) return false;
            this.ws.send(JSON.stringify(msg));
            return true;
        }

        private onDebuggerBreakpoint(breakMsg: pxsim.DebuggerBreakpointMessage) {
            this.trySendMessage(breakMsg);
        }

        private onDebuggerWarning(warnMsg: pxsim.DebuggerWarningMessage) {
            this.trySendMessage(warnMsg);
        }

        private onDebuggerResume() {

        }

        private onStateChanged(state: SimulatorState) {
            this.trySendMessage({
                type: "simstate",
                state
            } as Events.Sim.StateChanged);
        }
    }

    function parseMessage(m: string): DebuggerMessage {
        if (m) {
            try {
                return JSON.parse(m);
            }
            catch (e) {
                pxt.debug('unknown message: ' + m);
            }
        }

        return undefined;
    }
}