/// <reference path="./debugProtocol.ts" />
/// <reference path="./utils.ts" />

namespace pxsim {
    export function getWarningMessage(msg: string) {
        let r: DebuggerWarningMessage = {
            type: "debugger",
            subtype: "warning",
            breakpointIds: [],
            message: msg
        }

        let s = runtime.currFrame
        while (s != null) {
            r.breakpointIds.push(s.lastBrkId)
            s = s.parent
        }

        return r
    }

    export class BreakpointMap {
        public fileMap: { [index: string]: [number, DebugProtocol.Breakpoint][] } = {};
        public idMap: { [index: number]: DebugProtocol.Breakpoint } = {};

        constructor(breakpoints: [number, DebugProtocol.Breakpoint][]) {
            breakpoints.forEach(tuple => {
                const [id, bp] = tuple;
                if (!this.fileMap[bp.source.path]) {
                    this.fileMap[bp.source.path] = [];
                }

                this.fileMap[bp.source.path].push(tuple);
                this.idMap[id] = bp;
            });

            for (const file in this.fileMap) {
                const bps = this.fileMap[file];

                // Sort the breakpoints to make finding the closest breakpoint to a
                // given line easier later. Order first by start line and then from
                // worst to best choice for each line.
                this.fileMap[file] = bps.sort(([, a], [, b]) => {
                    if (a.line === b.line) {
                        if (b.endLine === a.endLine) {
                            return a.column - b.column;
                        }

                        // We want the closest breakpoint, so give preference to breakpoints
                        // that span fewer lines (i.e. breakpoints that are "tighter" around
                        // the line being searched for)
                        return b.endLine - a.endLine;
                    }
                    return a.line - b.line;
                });
            }
        }

        public getById(id: number): DebugProtocol.Breakpoint {
            return this.idMap[id];
        }

        public verifyBreakpoint(path: string, breakpoint: DebugProtocol.SourceBreakpoint): [number, DebugProtocol.Breakpoint] {
            const breakpoints = this.fileMap[path];

            let best: [number, DebugProtocol.Breakpoint];
            if (breakpoints) {
                // Breakpoints are pre-sorted for each file. The last matching breakpoint
                // in the list should be the best match
                for (const [id, bp] of breakpoints) {
                    if (bp.line <= breakpoint.line && bp.endLine >= breakpoint.line) {
                        best = [id, bp];
                    }
                }
            }

            if (best) {
                best[1].verified = true;
                return best;
            }

            return [-1, { verified: false }];
        }
    }

    export function dumpHeap(v: any, heap: Map<any>, fields?: string[]): Variables {
        function valToJSON(v: any) {
            switch (typeof v) {
                case "string":
                case "number":
                case "boolean":
                    return v;
                case "function":
                    return {
                        text: "(function)",
                        type: "function",
                    }
                case "undefined":
                    return null;
                case "object":
                    if (!v) return null;
                    if (v instanceof RefObject) {
                        heap[(v as RefObject).id] = v;
                        let preview = RefObject.toDebugString(v);
                        let type = preview.startsWith('[') ? "array" : preview;
                        return {
                            id: (v as RefObject).id,
                            preview: preview,
                            hasFields: (v as any).fields !== null || preview.startsWith('['),
                            type: type,
                        }
                    }
                    if (v._width && v._height) {
                        return {
                            text: v._width + 'x' + v._height,
                            type: "image",
                        }
                    }
                    return {
                        text: "(object)",
                        type: "object",
                    }
                default:
                    throw new Error();
            }
        }
        function frameVars(frame: any, fields?: string[]) {
            const r: Variables = {}
            for (let k of Object.keys(frame)) {
                // skip members starting with __
                if (!/^__/.test(k) && /___\d+$/.test(k)) {
                    r[k.replace(/___\d+$/, '')] = valToJSON(frame[k])
                }
            }
            if (frame.fields && fields) {
                // Fields of an object.
                for (let k of fields) {
                    k = k.substring(k.lastIndexOf(".") + 1);
                    r[k] = valToJSON(evalGetter(frame.vtable.iface[k], frame));
                }
            }
            if (frame.fields) {
                for (let k of Object.keys(frame.fields).filter(field => !field.startsWith('_'))) {
                    r[k.replace(/___\d+$/, '')] = valToJSON(frame.fields[k])
                }
            } else if (Array.isArray(frame.data)) {
                // This is an Array.
                (frame.data as any[]).forEach((element, index) => {
                    r[index] = valToJSON(element);
                });
            }
            return r
        }

        return frameVars(v, fields);
    }

    function evalGetter(fn: LabelFn, target: RefObject) {
        // This function evaluates a getter, and we assume it doesn't have any side effects.
        let parentFrame: any = {
        };

        // We create a dummy stack frame
        let stackFrame: any = {
            pc: 0,
            arg0: target,
            fn,
            parent: parentFrame
        };

        // And we evaluate the getter
        while (stackFrame.fn) {
            stackFrame = stackFrame.fn(stackFrame as any);
        }

        return stackFrame.retval;
    }

    export function getBreakpointMsg(s: pxsim.StackFrame, brkId: number): { msg: DebuggerBreakpointMessage, heap: Map<any> } {
        const heap: pxsim.Map<any> = {};

        const msg: DebuggerBreakpointMessage = {
            type: "debugger",
            subtype: "breakpoint",
            breakpointId: brkId,
            globals: dumpHeap(runtime.globals, heap),
            stackframes: [],
        }

        while (s != null) {
            let info = s.fn ? (s.fn as any).info : null
            if (info)
                msg.stackframes.push({
                    locals: dumpHeap(s, heap),
                    funcInfo: info,
                    breakpointId: s.lastBrkId
                })
            s = s.parent
        }

        return { msg, heap };
    }


    export interface SimLaunchArgs extends DebugProtocol.LaunchRequestArguments {
        /* Root directory of the project workspace being debugged */
        projectDir: string;
    }

    export class SimDebugSession extends protocol.DebugSession {
        // We only have one thread
        // TODO: We could theoretically visualize the individual fibers
        private static THREAD_ID = 1;
        private driver: SimulatorDriver;
        private lastBreak: DebuggerBreakpointMessage;
        private state: StoppedState;
        private projectDir: string;

        private breakpoints: BreakpointMap;

        constructor(container: HTMLElement) {
            super();

            let options: pxsim.SimulatorDriverOptions = {
                onDebuggerBreakpoint: b => this.onDebuggerBreakpoint(b),
                onDebuggerWarning: w => this.onDebuggerWarning(w),
                onDebuggerResume: () => this.onDebuggerResume(),
                onStateChanged: s => this.onStateChanged(s)
            };

            this.driver = new pxsim.SimulatorDriver(container, options);
        }

        public runCode(js: string, parts: string[], fnArgs: Map<string>, breakpoints: BreakpointMap, board: pxsim.BoardDefinition) {
            this.breakpoints = breakpoints;

            if (this.projectDir) {
                this.fixBreakpoints();
            }

            this.sendEvent(new protocol.InitializedEvent());
            this.driver.run(js, {
                parts,
                fnArgs,
                boardDefinition: board
            });
        }

        public stopSimulator(unload = false) {
            this.driver.stop(unload);
        }

        protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
            response.body.supportsConditionalBreakpoints = false;
            response.body.supportsHitConditionalBreakpoints = false;
            response.body.supportsFunctionBreakpoints = false;
            response.body.supportsEvaluateForHovers = false;
            response.body.supportsStepBack = false;
            response.body.supportsSetVariable = false;
            response.body.supportsRestartFrame = false;
            response.body.supportsStepInTargetsRequest = false;
            response.body.supportsGotoTargetsRequest = false;
            response.body.supportsCompletionsRequest = false;

            // This default debug adapter implements the 'configurationDone' request.
            response.body.supportsConfigurationDoneRequest = true;

            this.sendResponse(response);
        }

        protected disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments): void {
            this.sendResponse(response);
            this.shutdown();
        }

        protected launchRequest(response: DebugProtocol.LaunchResponse, args: SimLaunchArgs): void {
            if (!this.projectDir) {
                this.projectDir = util.normalizePath(args.projectDir);
                if (this.breakpoints) {
                    this.fixBreakpoints();
                }
            }
            this.sendResponse(response);
        }

        protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
            response.body = { breakpoints: [] };

            const ids: number[] = [];

            args.breakpoints.forEach(requestedBp => {
                if (this.breakpoints) {
                    const [id, bp] = this.breakpoints.verifyBreakpoint(util.relativePath(this.projectDir, args.source.path), requestedBp);
                    response.body.breakpoints.push(bp);

                    if (bp.verified) {
                        ids.push(id);
                    }
                }
                else {
                    response.body.breakpoints.push({ verified: false });
                }
            });

            this.driver.setBreakpoints(ids);

            this.sendResponse(response);
        }

        protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {
            this.driver.resume(SimulatorDebuggerCommand.Resume);
            this.sendResponse(response);
        }

        protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
            this.driver.resume(SimulatorDebuggerCommand.StepOver);
            this.sendResponse(response);
        }

        protected stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments): void {
            this.driver.resume(SimulatorDebuggerCommand.StepInto);
            this.sendResponse(response);
        }

        protected stepOutRequest(response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments): void {
            this.driver.resume(SimulatorDebuggerCommand.StepOut);
            this.sendResponse(response);
        }

        protected pauseRequest(response: DebugProtocol.PauseResponse, args: DebugProtocol.PauseArguments): void {
            this.driver.resume(SimulatorDebuggerCommand.Pause);
            this.sendResponse(response);
        }

        protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
            response.body = { threads: [{ id: SimDebugSession.THREAD_ID, name: "main" }] }
            this.sendResponse(response);
        }

        protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {
            if (this.lastBreak) {
                const frames = this.state.getFrames();
                response.body = { stackFrames: frames };
            }
            this.sendResponse(response);
        }

        protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {
            if (this.state) {
                response.body = { scopes: this.state.getScopes(args.frameId) }
            }

            this.sendResponse(response);
        }

        protected variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): void {
            if (this.state) {
                response.body = { variables: this.state.getVariables(args.variablesReference) };
            }

            this.sendResponse(response);
        }

        private onDebuggerBreakpoint(breakMsg: DebuggerBreakpointMessage) {
            this.lastBreak = breakMsg;
            this.state = new StoppedState(this.lastBreak, this.breakpoints, this.projectDir);

            if (breakMsg.exceptionMessage) {
                const message = breakMsg.exceptionMessage.replace(/___\d+/g, '');
                this.sendEvent(new protocol.StoppedEvent("exception", SimDebugSession.THREAD_ID, message));
            }
            else {
                this.sendEvent(new protocol.StoppedEvent("breakpoint", SimDebugSession.THREAD_ID));
            }
        }

        private onDebuggerWarning(warnMsg: DebuggerWarningMessage) {
        }

        private onDebuggerResume() {
            this.sendEvent(new protocol.ContinuedEvent(SimDebugSession.THREAD_ID, true));
        }

        private onStateChanged(state: SimulatorState) {
            switch (state) {
                case SimulatorState.Paused:
                    // Sending a stopped event here would be redundant
                    break;
                case SimulatorState.Running:
                    this.sendEvent(new protocol.ContinuedEvent(SimDebugSession.THREAD_ID, true))
                    break;
                case SimulatorState.Stopped:
                    this.sendEvent(new protocol.TerminatedEvent())
                    break;
                //case SimulatorState.Unloaded:
                //case SimulatorState.Pending:
                default:
            }
        }

        private fixBreakpoints() {
            // Fix breakpoint locations from the debugger's format to the client's
            for (const bpId in this.breakpoints.idMap) {
                const bp = this.breakpoints.idMap[bpId];
                bp.source.path = util.pathJoin(this.projectDir, bp.source.path);

                bp.line = this.convertDebuggerLineToClient(bp.line);
                bp.endLine = this.convertDebuggerLineToClient(bp.endLine);
                bp.column = this.convertDebuggerColumnToClient(bp.column);
                bp.endColumn = this.convertDebuggerColumnToClient(bp.endColumn);
            }
        }
    }

    interface SimFrame {
        locals: Variables;
        breakpointId: number;

        // pxtc.FunctionLocationInfo
        // FIXME: Make this dependency explicit
        funcInfo: {
            functionName: string;
            fileName: string;
            start: number;
            length: number;
            line: number;
            column: number;
            endLine?: number;
            endColumn?: number;
        };
    }

    /**
     * Maintains the state at the current breakpoint and handles lazy
     * queries for stack frames, scopes, variables, etc. The protocol
     * expects requests to be made in the order:
     *      Frames -> Scopes -> Variables
     */
    class StoppedState {
        private _currentId: number = 1;
        private _frames: { [index: number]: SimFrame } = {};
        private _vars: { [index: number]: util.Lazy<protocol.Variable[]> } = {};
        private _globalScope: DebugProtocol.Scope;

        constructor(private _message: DebuggerBreakpointMessage, private _map: BreakpointMap, private _dir: string) {
            const globalId = this.nextId();
            this._vars[globalId] = this.getVariableValues(this._message.globals);
            this._globalScope = {
                name: "Globals",
                variablesReference: globalId,
                expensive: false
            };
        }

        /**
         * Get stack frames for current breakpoint.
         */
        getFrames(): DebugProtocol.StackFrame[] {
            return this._message.stackframes.map((s: SimFrame, i: number) => {
                const bp = this._map.getById(s.breakpointId);
                if (bp) {
                    this._frames[s.breakpointId] = s;
                    return {
                        id: s.breakpointId,
                        name: s.funcInfo ? s.funcInfo.functionName : (i === 0 ? "main" : "anonymous"),
                        line: bp.line,
                        column: bp.column,
                        endLine: bp.endLine,
                        endColumn: bp.endLine,
                        source: bp.source
                    };
                }
                return undefined;
            }).filter(b => !!b);
        }

        /**
         * Returns scopes visible to the given stack frame.
         *
         * TODO: Currently, we only support locals and globals (no closures)
         */
        getScopes(frameId: number): DebugProtocol.Scope[] {
            const frame = this._frames[frameId];

            if (frame) {
                const localId = this.nextId();
                this._vars[localId] = this.getVariableValues(frame.locals);
                return [{
                    name: "Locals",
                    variablesReference: localId,
                    expensive: false
                }, this._globalScope];
            }

            return [this._globalScope];
        }

        /**
         * Returns variable information (and object properties)
         */
        getVariables(variablesReference: number): DebugProtocol.Variable[] {
            const lz = this._vars[variablesReference];
            return (lz && lz.value) || [];
        }

        private getVariableValues(v: Variables): util.Lazy<DebugProtocol.Variable[]> {
            return new util.Lazy(() => {
                const result: DebugProtocol.Variable[] = [];

                for (const name in v) {
                    const value = v[name];
                    let vString: string;
                    let variablesReference = 0;

                    if (value === null) {
                        vString = "null";
                    }
                    else if (value === undefined) {
                        vString = "undefined"
                    }
                    else if (typeof value === "object") {
                        vString = "(object)";
                        variablesReference = this.nextId();
                        // Variables should be requested lazily, so reference loops aren't an issue
                        this._vars[variablesReference] = this.getVariableValues(value);
                    }
                    else {
                        vString = value.toString();
                    }

                    // Remove the metadata from the name
                    const displayName = name.substr(0, name.lastIndexOf("___"));

                    result.push({
                        name: displayName,
                        value: vString,
                        variablesReference
                    });
                }
                return result;
            });
        }

        private nextId(): number {
            return this._currentId++;
        }
    }
}
