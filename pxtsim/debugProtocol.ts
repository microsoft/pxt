/// <reference path="../localtypings/vscode-debug-protocol.d.ts" />

/**
 * Heavily adapted from https://github.com/microsoft/vscode-debugadapter-node
 * and altered to run in a browser and communcate via JSON over a websocket
 * rather than through stdin and stdout
 */
namespace pxsim.protocol {
    /**
     * Host for debug session that is responsible with communication with
     * the debugger's user interface.
     */
    export interface DebugSessionHost {
        send(msg: string): void;
        onData(cb: (msg: DebugProtocol.ProtocolMessage) => void): void;
        onError(cb: (e?: any) =>  void): void;
        onClose(cb: () => void): void;
        close(): void;
    }

    export class Message implements DebugProtocol.ProtocolMessage {
        seq: number;
        type: string;

        public constructor(type: string) {
            this.seq = 0;
            this.type = type;
        }
    }

    export class Response extends Message implements DebugProtocol.Response {
        request_seq: number;
        success: boolean;
        command: string;

        public constructor(request: DebugProtocol.Request, message?: string) {
            super('response');
            this.request_seq = request.seq;
            this.command = request.command;
            if (message) {
                this.success = false;
                (<any>this).message = message;
            } else {
                this.success = true;
            }
        }
    }

    export class Event extends Message implements DebugProtocol.Event {
        event: string;

        public constructor(event: string, body?: any) {
            super('event');
            this.event = event;
            if (body) {
                (<any>this).body = body;
            }
        }
    }

    export class Source implements DebugProtocol.Source {
        name: string;
        path: string;
        sourceReference: number;

        public constructor(name: string, path: string, id: number = 0, origin?: string, data?: any) {
            this.name = name;
            this.path = path;
            this.sourceReference = id;
            if (origin) {
                (<any>this).origin = origin;
            }
            if (data) {
                (<any>this).adapterData = data;
            }
        }
    }

    export class Scope implements DebugProtocol.Scope {
        name: string;
        variablesReference: number;
        expensive: boolean;

        public constructor(name: string, reference: number, expensive: boolean = false) {
            this.name = name;
            this.variablesReference = reference;
            this.expensive = expensive;
        }
    }

    export class StackFrame implements DebugProtocol.StackFrame {
        id: number;
        source: Source;
        line: number;
        column: number;
        name: string;

        public constructor(i: number, nm: string, src?: Source, ln: number = 0, col: number = 0) {
            this.id = i;
            this.source = src;
            this.line = ln;
            this.column = col;
            this.name = nm;
        }
    }

    export class Thread implements DebugProtocol.Thread {
        id: number;
        name: string;

        public constructor(id: number, name: string) {
            this.id = id;
            if (name) {
                this.name = name;
            } else {
                this.name = 'Thread #' + id;
            }
        }
    }

    export class Variable implements DebugProtocol.Variable {
        name: string;
        value: string;
        variablesReference: number;

        public constructor(name: string, value: string, ref: number = 0, indexedVariables?: number, namedVariables?: number) {
            this.name = name;
            this.value = value;
            this.variablesReference = ref;
            if (typeof namedVariables === 'number') {
                (<DebugProtocol.Variable>this).namedVariables = namedVariables;
            }
            if (typeof indexedVariables === 'number') {
                (<DebugProtocol.Variable>this).indexedVariables = indexedVariables;
            }
        }
    }

    export class Breakpoint implements DebugProtocol.Breakpoint {
        verified: boolean;

        public constructor(verified: boolean, line?: number, column?: number, source?: Source) {
            this.verified = verified;
            const e: DebugProtocol.Breakpoint = this;
            if (typeof line === 'number') {
                e.line = line;
            }
            if (typeof column === 'number') {
                e.column = column;
            }
            if (source) {
                e.source = source;
            }
        }
    }

    export class Module implements DebugProtocol.Module {
        id: number | string;
        name: string;

        public constructor(id: number | string, name: string) {
            this.id = id;
            this.name = name;
        }
    }

    export class CompletionItem implements DebugProtocol.CompletionItem {
        label: string;
        start: number;
        length: number;

        public constructor(label: string, start: number, length: number = 0) {
            this.label = label;
            this.start = start;
            this.length = length;
        }
    }

    export class StoppedEvent extends Event implements DebugProtocol.StoppedEvent {
        body: {
            reason: string;
            threadId: number;
        };

        public constructor(reason: string, threadId: number, exception_text: string = null) {
            super('stopped');
            this.body = {
                reason: reason,
                threadId: threadId
            };

            if (exception_text) {
                const e: DebugProtocol.StoppedEvent = this;
                e.body.text = exception_text;
            }
        }
    }

    export class ContinuedEvent extends Event implements DebugProtocol.ContinuedEvent {
        body: {
            threadId: number;
        };

        public constructor(threadId: number, allThreadsContinued?: boolean) {
            super('continued');
            this.body = {
                threadId: threadId
            };

            if (typeof allThreadsContinued === 'boolean') {
                (<DebugProtocol.ContinuedEvent>this).body.allThreadsContinued = allThreadsContinued;
            }
        }
    }

    export class InitializedEvent extends Event implements DebugProtocol.InitializedEvent {
        public constructor() {
            super('initialized');
        }
    }

    export class TerminatedEvent extends Event implements DebugProtocol.TerminatedEvent {
        public constructor(restart?: boolean) {
            super('terminated');
            if (typeof restart === 'boolean') {
                const e: DebugProtocol.TerminatedEvent = this;
                e.body = {
                    restart: restart
                };
            }
        }
    }

    export class OutputEvent extends Event implements DebugProtocol.OutputEvent {
        body: {
            category: string,
            output: string,
            data?: any
        };

        public constructor(output: string, category: string = 'console', data?: any) {
            super('output');
            this.body = {
                category: category,
                output: output
            };
            if (data !== undefined) {
                this.body.data = data;
            }
        }
    }

    export class ThreadEvent extends Event implements DebugProtocol.ThreadEvent {
        body: {
            reason: string,
            threadId: number
        };

        public constructor(reason: string, threadId: number) {
            super('thread');
            this.body = {
                reason: reason,
                threadId: threadId
            };
        }
    }

    export class BreakpointEvent extends Event implements DebugProtocol.BreakpointEvent {
        body: {
            reason: string,
            breakpoint: Breakpoint
        };

        public constructor(reason: string, breakpoint: Breakpoint) {
            super('breakpoint');
            this.body = {
                reason: reason,
                breakpoint: breakpoint
            };
        }
    }

    export class ModuleEvent extends Event implements DebugProtocol.ModuleEvent {
        body: {
            reason: 'new' | 'changed' | 'removed',
            module: Module
        };

        public constructor(reason: 'new' | 'changed' | 'removed', module: Module) {
            super('module');
            this.body = {
                reason: reason,
                module: module
            };
        }
    }

    export class ProtocolServer {
        private host: DebugSessionHost;
        private _pendingRequests: { [index: number]: (response: DebugProtocol.Response) => void } = {};
        private _sequence: number;

        public start(host: DebugSessionHost): void {
            this._sequence = 1;
            this.host = host;

            this.host.onData(msg => {
                if (msg.type === 'request') {
                    this.dispatchRequest(<DebugProtocol.Request> msg);
                } else if (msg.type === 'response') {
                    const response = <DebugProtocol.Response> msg;
                    const clb = this._pendingRequests[response.seq];
                    if (clb) {
                        delete this._pendingRequests[response.seq];
                        clb(response);
                    }
                }
            });
        }

        public stop(): void {
            if (this.host) {
                this.host.close();
            }
        }

        public sendEvent(event: DebugProtocol.Event): void {
            this.send('event', event);
        }

        public sendResponse(response: DebugProtocol.Response): void {
            if (response.seq > 0) {
                console.error(`attempt to send more than one response for command ${response.command}`);
            } else {
                this.send('response', response);
            }
        }

        public sendRequest(command: string, args: any, timeout: number, cb: (response: DebugProtocol.Response) => void): void {

            const request: any = {
                command: command
            };
            if (args && Object.keys(args).length > 0) {
                request.arguments = args;
            }

            this.send('request', request);

            if (cb) {
                this._pendingRequests[request.seq] = cb;

                const timer = setTimeout(() => {
                    clearTimeout(timer);
                    const clb = this._pendingRequests[request.seq];
                    if (clb) {
                        delete this._pendingRequests[request.seq];
                        clb(new protocol.Response(request, 'timeout'));
                    }
                }, timeout);
            }
        }

        private send(typ: 'request' | 'response' | 'event', message: DebugProtocol.ProtocolMessage)  {
            message.type = typ;
            message.seq = this._sequence++;

            if (this.host) {
                const json = JSON.stringify(message);
                this.host.send(json);
            }
        }

        // ---- protected ----------------------------------------------------------

        protected dispatchRequest(request: DebugProtocol.Request): void {
        }
    }

    export class DebugSession extends ProtocolServer {
        private _debuggerLinesStartAt1: boolean = false;
        private _debuggerColumnsStartAt1: boolean = false;
        private _debuggerPathsAreURIs: boolean;

        private _clientLinesStartAt1: boolean = true;
        private _clientColumnsStartAt1: boolean = true;
        private _clientPathsAreURIs: boolean;

        private _isServer: boolean;

        public shutdown(): void {
        }

        protected dispatchRequest(request: DebugProtocol.Request): void {
            const response = new protocol.Response(request);

            try {
                if (request.command === 'initialize') {
                    let args = <DebugProtocol.InitializeRequestArguments> request.arguments;

                    if (typeof args.linesStartAt1 === 'boolean') {
                        this._clientLinesStartAt1 = args.linesStartAt1;
                    }
                    if (typeof args.columnsStartAt1 === 'boolean') {
                        this._clientColumnsStartAt1 = args.columnsStartAt1;
                    }

                    if (args.pathFormat !== 'path') {
                        this.sendErrorResponse(response, 2018, 'debug adapter only supports native paths', null);
                    } else {
                        const initializeResponse = <DebugProtocol.InitializeResponse> response;
                        initializeResponse.body = {};
                        this.initializeRequest(initializeResponse, args);
                    }

                } else if (request.command === 'launch') {
                    this.launchRequest(<DebugProtocol.LaunchResponse> response, request.arguments);

                } else if (request.command === 'attach') {
                    this.attachRequest(<DebugProtocol.AttachResponse> response, request.arguments);

                } else if (request.command === 'disconnect') {
                    this.disconnectRequest(<DebugProtocol.DisconnectResponse> response, request.arguments);

                } else if (request.command === 'setBreakpoints') {
                    this.setBreakPointsRequest(<DebugProtocol.SetBreakpointsResponse> response, request.arguments);

                } else if (request.command === 'setFunctionBreakpoints') {
                    this.setFunctionBreakPointsRequest(<DebugProtocol.SetFunctionBreakpointsResponse> response, request.arguments);

                } else if (request.command === 'setExceptionBreakpoints') {
                    this.setExceptionBreakPointsRequest(<DebugProtocol.SetExceptionBreakpointsResponse> response, request.arguments);

                } else if (request.command === 'configurationDone') {
                    this.configurationDoneRequest(<DebugProtocol.ConfigurationDoneResponse> response, request.arguments);

                } else if (request.command === 'continue') {
                    this.continueRequest(<DebugProtocol.ContinueResponse> response, request.arguments);

                } else if (request.command === 'next') {
                    this.nextRequest(<DebugProtocol.NextResponse> response, request.arguments);

                } else if (request.command === 'stepIn') {
                    this.stepInRequest(<DebugProtocol.StepInResponse> response, request.arguments);

                } else if (request.command === 'stepOut') {
                    this.stepOutRequest(<DebugProtocol.StepOutResponse> response, request.arguments);

                } else if (request.command === 'stepBack') {
                    this.stepBackRequest(<DebugProtocol.StepBackResponse> response, request.arguments);

                } else if (request.command === 'restartFrame') {
                    this.restartFrameRequest(<DebugProtocol.RestartFrameResponse> response, request.arguments);

                } else if (request.command === 'goto') {
                    this.gotoRequest(<DebugProtocol.GotoResponse> response, request.arguments);

                } else if (request.command === 'pause') {
                    this.pauseRequest(<DebugProtocol.PauseResponse> response, request.arguments);

                } else if (request.command === 'stackTrace') {
                    this.stackTraceRequest(<DebugProtocol.StackTraceResponse> response, request.arguments);

                } else if (request.command === 'scopes') {
                    this.scopesRequest(<DebugProtocol.ScopesResponse> response, request.arguments);

                } else if (request.command === 'variables') {
                    this.variablesRequest(<DebugProtocol.VariablesResponse> response, request.arguments);

                } else if (request.command === 'setVariable') {
                    this.setVariableRequest(<DebugProtocol.SetVariableResponse> response, request.arguments);

                } else if (request.command === 'source') {
                    this.sourceRequest(<DebugProtocol.SourceResponse> response, request.arguments);

                } else if (request.command === 'threads') {
                    this.threadsRequest(<DebugProtocol.ThreadsResponse> response);

                } else if (request.command === 'evaluate') {
                    this.evaluateRequest(<DebugProtocol.EvaluateResponse> response, request.arguments);

                } else if (request.command === 'stepInTargets') {
                    this.stepInTargetsRequest(<DebugProtocol.StepInTargetsResponse> response, request.arguments);

                } else if (request.command === 'gotoTargets') {
                    this.gotoTargetsRequest(<DebugProtocol.GotoTargetsResponse> response, request.arguments);

                } else if (request.command === 'completions') {
                    this.completionsRequest(<DebugProtocol.CompletionsResponse> response, request.arguments);

                } else {
                    this.customRequest(request.command, <DebugProtocol.Response> response, request.arguments);
                }
            } catch (e) {
                this.sendErrorResponse(response, 1104, '{_stack}', { _exception: e.message, _stack: e.stack });
            }
        }

        protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {

            // This default debug adapter does not support conditional breakpoints.
            response.body.supportsConditionalBreakpoints = false;

            // This default debug adapter does not support hit conditional breakpoints.
            response.body.supportsHitConditionalBreakpoints = false;

            // This default debug adapter does not support function breakpoints.
            response.body.supportsFunctionBreakpoints = false;

            // This default debug adapter implements the 'configurationDone' request.
            response.body.supportsConfigurationDoneRequest = true;

            // This default debug adapter does not support hovers based on the 'evaluate' request.
            response.body.supportsEvaluateForHovers = false;

            // This default debug adapter does not support the 'stepBack' request.
            response.body.supportsStepBack = false;

            // This default debug adapter does not support the 'setVariable' request.
            response.body.supportsSetVariable = false;

            // This default debug adapter does not support the 'restartFrame' request.
            response.body.supportsRestartFrame = false;

            // This default debug adapter does not support the 'stepInTargetsRequest' request.
            response.body.supportsStepInTargetsRequest = false;

            // This default debug adapter does not support the 'gotoTargetsRequest' request.
            response.body.supportsGotoTargetsRequest = false;

            // This default debug adapter does not support the 'completionsRequest' request.
            response.body.supportsCompletionsRequest = false;

            this.sendResponse(response);
        }

        protected disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments): void {
            this.sendResponse(response);
            this.shutdown();
        }

        protected launchRequest(response: DebugProtocol.LaunchResponse, args: DebugProtocol.LaunchRequestArguments): void {
            this.sendResponse(response);
        }

        protected attachRequest(response: DebugProtocol.AttachResponse, args: DebugProtocol.AttachRequestArguments): void {
            this.sendResponse(response);
        }

        protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
            this.sendResponse(response);
        }

        protected setFunctionBreakPointsRequest(response: DebugProtocol.SetFunctionBreakpointsResponse, args: DebugProtocol.SetFunctionBreakpointsArguments): void {
            this.sendResponse(response);
        }

        protected setExceptionBreakPointsRequest(response: DebugProtocol.SetExceptionBreakpointsResponse, args: DebugProtocol.SetExceptionBreakpointsArguments): void {
            this.sendResponse(response);
        }

        protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void {
            this.sendResponse(response);
        }

        protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {
            this.sendResponse(response);
        }

        protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
            this.sendResponse(response);
        }

        protected stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments): void {
            this.sendResponse(response);
        }

        protected stepOutRequest(response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments): void {
            this.sendResponse(response);
        }

        protected stepBackRequest(response: DebugProtocol.StepBackResponse, args: DebugProtocol.StepBackArguments): void {
            this.sendResponse(response);
        }

        protected restartFrameRequest(response: DebugProtocol.RestartFrameResponse, args: DebugProtocol.RestartFrameArguments): void {
            this.sendResponse(response);
        }

        protected gotoRequest(response: DebugProtocol.GotoResponse, args: DebugProtocol.GotoArguments): void {
            this.sendResponse(response);
        }

        protected pauseRequest(response: DebugProtocol.PauseResponse, args: DebugProtocol.PauseArguments): void {
            this.sendResponse(response);
        }

        protected sourceRequest(response: DebugProtocol.SourceResponse, args: DebugProtocol.SourceArguments): void {
            this.sendResponse(response);
        }

        protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
            this.sendResponse(response);
        }

        protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {
            this.sendResponse(response);
        }

        protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {
            this.sendResponse(response);
        }

        protected variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): void {
            this.sendResponse(response);
        }

        protected setVariableRequest(response: DebugProtocol.SetVariableResponse, args: DebugProtocol.SetVariableArguments): void {
            this.sendResponse(response);
        }

        protected evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): void {
            this.sendResponse(response);
        }

        protected stepInTargetsRequest(response: DebugProtocol.StepInTargetsResponse, args: DebugProtocol.StepInTargetsArguments): void {
            this.sendResponse(response);
        }

        protected gotoTargetsRequest(response: DebugProtocol.GotoTargetsResponse, args: DebugProtocol.GotoTargetsArguments): void {
            this.sendResponse(response);
        }

        protected completionsRequest(response: DebugProtocol.CompletionsResponse, args: DebugProtocol.CompletionsArguments): void {
            this.sendResponse(response);
        }

        /**
         * Override this hook to implement custom requests.
         */
        protected customRequest(command: string, response: DebugProtocol.Response, args: any): void {
            this.sendErrorResponse(response, 1014, 'unrecognized request', null);
        }

        protected sendErrorResponse(response: DebugProtocol.Response, codeOrMessage: number | DebugProtocol.Message, format?: string, variables?: any): void {

            let msg: DebugProtocol.Message;
            if (typeof codeOrMessage === 'number') {
                msg = <DebugProtocol.Message> {
                    id: <number> codeOrMessage,
                    format: format
                };
                if (variables) {
                    msg.variables = variables;
                }
                msg.showUser = true;
            } else {
                msg = codeOrMessage;
            }

            response.success = false;
            DebugSession.formatPII(msg.format, true, msg.variables);
            if (!response.body) {
                response.body = { };
            }
            response.body.error = msg;

            this.sendResponse(response);
        }

        protected convertClientLineToDebugger(line: number): number {
            if (this._debuggerLinesStartAt1) {
                return this._clientLinesStartAt1 ? line : line + 1;
            }
            return this._clientLinesStartAt1 ? line - 1 : line;
        }

        protected convertDebuggerLineToClient(line: number): number {
            if (this._debuggerLinesStartAt1) {
                return this._clientLinesStartAt1 ? line : line - 1;
            }
            return this._clientLinesStartAt1 ? line + 1 : line;
        }

        protected convertClientColumnToDebugger(column: number): number {
            if (this._debuggerColumnsStartAt1) {
                return this._clientColumnsStartAt1 ? column : column + 1;
            }
            return this._clientColumnsStartAt1 ? column - 1 : column;
        }

        protected convertDebuggerColumnToClient(column: number): number {
            if (this._debuggerColumnsStartAt1) {
                return this._clientColumnsStartAt1 ? column : column - 1;
            }
            return this._clientColumnsStartAt1 ? column + 1 : column;
        }

        protected convertClientPathToDebugger(clientPath: string): string {
            if (this._clientPathsAreURIs != this._debuggerPathsAreURIs) {
                if (this._clientPathsAreURIs) {
                    return DebugSession.uri2path(clientPath);
                } else {
                    return DebugSession.path2uri(clientPath);
                }
            }
            return clientPath;
        }

        protected convertDebuggerPathToClient(debuggerPath: string): string {
            if (this._debuggerPathsAreURIs != this._clientPathsAreURIs) {
                if (this._debuggerPathsAreURIs) {
                    return DebugSession.uri2path(debuggerPath);
                } else {
                    return DebugSession.path2uri(debuggerPath);
                }
            }
            return debuggerPath;
        }

        private static path2uri(str: string): string {
            let pathName = str.replace(/\\/g, '/');
            if (pathName[0] !== '/') {
                pathName = '/' + pathName;
            }
            return encodeURI('file://' + pathName);
        }

        private static uri2path(url: string): string {
            return url;
            //return Url.parse(url).pathname;
        }

        private static _formatPIIRegexp = /{([^}]+)}/g;

        /*
        * If argument starts with '_' it is OK to send its value to telemetry.
        */
        private static formatPII(format: string, excludePII: boolean, args: { [key: string]: string }): string {
            return format.replace(DebugSession._formatPIIRegexp, function(match, paramName) {
                if (excludePII && paramName.length > 0 && paramName[0] !== '_') {
                    return match;
                }
                return args[paramName] && args.hasOwnProperty(paramName) ?
                    args[paramName] :
                    match;
            })
        }
    }
}