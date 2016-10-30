namespace pxt.runner {
    export class DebugRunner {
        private driver: pxsim.SimulatorDriver;
        private ws: WebSocket;
        private pkgLoaded = false;

        constructor(container: HTMLElement) {
            let options: pxsim.SimulatorDriverOptions = {};
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
                this.trySendSimpleMessage(DebugMessageType.ready);
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
                if (m && "id" in m) {
                    this.handleMessage(m);
                }
            }
        }

        private runCode(m: BuildResult) {
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
                this.trySendMessage({
                    id: DebugMessageType.simstate,
                    state: SimulatorState.Running
                } as SimStateMessage);
            }
            else {
                this.driver.stop();
                this.trySendMessage({
                    id: DebugMessageType.simstate,
                    state: SimulatorState.Paused
                } as SimStateMessage);
            }
        }

        private handleMessage(m: DebugMessage) {
            switch (m.id) {
                case DebugMessageType.ready:
                    if (this.pkgLoaded) {
                        this.trySendSimpleMessage(DebugMessageType.ready);
                    }
                    break;
                case DebugMessageType.runcode:
                    this.runCode(m as RuncodeMessage);
                    break;
            }
        }

        private trySendSimpleMessage(id: DebugMessageType): boolean {
            return this.trySendMessage({ id });
        }

        private trySendMessage(msg: DebugMessage): boolean {
            if (!this.ws) return false;
            this.ws.send(JSON.stringify(msg));
            return true;
        }
    }

    export function startDebuggerAsync(container: HTMLElement) {
        const debugRunner = new DebugRunner(container);
    }

    function parseMessage(m: string): DebugMessage {
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