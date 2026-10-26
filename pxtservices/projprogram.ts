/**
 * The compiled-program ("projprogram") messages a simulator extension
 * exchanges with the editor, and a client that wraps them in promises. The
 * editor serves them only to simulator extensions registered with
 * `allowProgramRead`.
 *
 * Every compile request compiles the project open in the editor, as the
 * editor holds it when the request's compile starts: changes the user has not
 * saved are included, and what the user types in a text editor reaches the
 * project about half a second after the last keystroke. The reply is the
 * program a simulator run of the project executes: its JavaScript and the run
 * options the editor would pass the simulator for a plain run (no debugging,
 * no tracing, sound on). The program is the user's whole program, its
 * extensions' code included. A compile changes nothing the user sees: the
 * editor shows no diagnostics for it, and the simulator neither stops nor
 * starts.
 *
 * Requests are posted to the editor window; the editor replies to each
 * request once, to the requesting frame only, with the request's `id`. The
 * editor answers the requests of the extensions of one GitHub repository in
 * the order they arrive, whichever of their frames sent them, and compiles
 * for one request at a time; a request that arrives while a compile runs
 * waits for it and then compiles again. A repository's compiles beyond 5
 * within any 10 seconds wait, with the requests behind them, until the window
 * allows them.
 *
 * This module has no dependencies; a simulator extension can import or copy it
 * as-is.
 */

/** The `type` of every projprogram request and reply. */
export const PROJPROGRAM_MESSAGE_TYPE = "projprogram";

/**
 * Returns the origin of the editor hosting this simulator extension's frame,
 * e.g. `https://arcade.makecode.com`, which the editor passes in the frame
 * URL's `parentOrigin` parameter. Post requests to it.
 * @param search the frame URL's query string; defaults to `window.location.search`
 * @returns the origin, or undefined if the URL provides none
 */
export function getParentOrigin(search?: string): string | undefined {
    const query = search !== undefined ? search : window.location.search;
    return new URLSearchParams(query).get("parentOrigin") || undefined;
}

/**
 * Returns the level of the simulator-extension APIs the editor hosting this
 * frame serves, which the editor passes in the frame URL's `apiLevel`
 * parameter. Level 1 is the `projfs`, `projassets`, `projprogram` and
 * `simxeditor` messages and the registration fields; each later level adds to
 * or alters them. Read it at startup to learn whether the editor answers a
 * request before sending it.
 * @param search the frame URL's query string; defaults to `window.location.search`
 * @returns the level; 0, the level of an editor older than level 1, if the URL
 * provides none or one that is not a non-negative integer
 */
export function getSimxApiLevel(search?: string): number {
    const query = search !== undefined ? search : window.location.search;
    const value = new URLSearchParams(query).get("apiLevel");
    return value !== null && /^[0-9]+$/.test(value) ? Number(value) : 0;
}

/**
 * Why a request failed. Clients branch on the code; the message that
 * accompanies it is for people.
 */
export type ProjprogramErrorCode =
    /**
     * The compile produced no simulator program, as when the project has
     * errors; the reply's `diagnostics` lists what the compile reported.
     */
    | "COMPILE_FAILED"
    /** The request is malformed, or names a request the editor does not serve. */
    | "INVALID_REQUEST"
    /**
     * No project was open when the request arrived, or the project open then
     * failed to load or closed before its program was ready, as when another
     * project replaced it; a later request may succeed.
     */
    | "PROJECT_CLOSED"
    /**
     * The requesting frame is not a simulator extension the editor serves,
     * for instance because the open project does not use the extension.
     */
    | "UNREGISTERED"
    /** The simulator extension's registration does not set `allowProgramRead`. */
    | "PERMISSION_DENIED"
    /**
     * The editor met an error compiling the project. Also raised by the
     * client when the request cannot be posted; the request was not sent.
     */
    | "FAILED"
    /**
     * The client was disposed, as when its frame is torn down, before the
     * editor replied; or the request was made after the client was disposed,
     * and was not sent (raised by the client).
     */
    | "DISPOSED";

interface ProjprogramMessage {
    type: "projprogram";
    /** Chosen by the requester; the reply carries the same `id`. */
    id: string;
}

/** Compiles the open project. The reply is a {@link ProjprogramProgramReply}. */
export interface ProjprogramCompileRequest extends ProjprogramMessage {
    subtype: "compile";
}

export type ProjprogramRequest = ProjprogramCompileRequest;

/**
 * The run options of a simulator run, as the editor passes them to its
 * simulator driver (`pxsim.SimulatorRunOptions`): among others the board
 * definition, the parts and part definitions the program uses, its function
 * arguments (`fnArgs`), the simulator's aspect ratio, the CDN URL, the
 * localized strings, the project's version and dependencies, its stored
 * state, the active player and the simulator theme. An option the run does
 * not set is absent or undefined.
 */
export interface ProjprogramRunOptions {
    [option: string]: unknown;
}

/** The reply to a {@link ProjprogramCompileRequest}: the program a simulator run of the project executes. */
export interface ProjprogramProgramReply extends ProjprogramMessage {
    subtype: "program";
    /** The program's JavaScript, as the simulator runs it. */
    code: string;
    /** The run options the editor would pass the simulator for a plain run of the program. */
    options: ProjprogramRunOptions;
}

/** A diagnostic the compile reported. */
export interface ProjprogramDiagnostic {
    /** The project file the diagnostic is in, e.g. `main.ts`; absent if it concerns no file. */
    fileName?: string;
    /** The zero-based line of the file it starts on; absent if it concerns no file. */
    line?: number;
    /** The zero-based column of the line it starts at; absent if it concerns no file. */
    column?: number;
    /** The compiler's number for the diagnostic, e.g. 2304. */
    code: number;
    /** How severe it is. */
    category: "error" | "warning" | "message";
    /** What it says, for people. */
    message: string;
}

export interface ProjprogramErrorReply extends Omit<ProjprogramMessage, "id"> {
    /** The request's `id`; undefined if the request carried no string `id`. */
    id: string | undefined;
    subtype: "error";
    code: ProjprogramErrorCode;
    message: string;
    /** With `COMPILE_FAILED`, the diagnostics the compile reported, in its order; absent otherwise. */
    diagnostics?: ProjprogramDiagnostic[];
}

export type ProjprogramReply = ProjprogramProgramReply | ProjprogramErrorReply;

/** What {@link ProjprogramClient.compile} resolves with: the program a simulator run of the project executes. */
export interface ProjprogramProgram {
    /** The program's JavaScript, as the simulator runs it. */
    code: string;
    /** The run options the editor would pass the simulator for a plain run of the program. */
    options: ProjprogramRunOptions;
}

/** A refused or unanswered request. */
export class ProjprogramError extends Error {
    /**
     * @param diagnostics with `COMPILE_FAILED`, the diagnostics the compile
     * reported; empty otherwise
     */
    constructor(public readonly code: ProjprogramErrorCode, message: string, public readonly diagnostics: ProjprogramDiagnostic[] = []) {
        super(message);
        this.name = "ProjprogramError";
        // keeps instanceof working when compiled to ES5
        Object.setPrototypeOf(this, ProjprogramError.prototype);
    }
}

/** The window a {@link ProjprogramClient} posts requests to. */
export interface ProjprogramTargetWindow {
    postMessage(message: any, targetOrigin: string): void;
}

/** The window a {@link ProjprogramClient} receives replies on. */
export interface ProjprogramListenerWindow {
    addEventListener(type: "message", listener: (ev: MessageEvent) => void): void;
    removeEventListener(type: "message", listener: (ev: MessageEvent) => void): void;
}

export interface ProjprogramClientOptions {
    /** The editor window; defaults to `window.parent`. Messages from any other window are ignored. */
    target?: ProjprogramTargetWindow;
    /** The window replies arrive on; defaults to `window`. */
    listener?: ProjprogramListenerWindow;
    /**
     * The origin requests may be delivered to; defaults to the frame URL's
     * `parentOrigin` parameter, else `"*"`.
     */
    targetOrigin?: string;
    /** The frame URL's query string the default {@link targetOrigin} is read from; defaults to `window.location.search`. */
    search?: string;
    /** How long, in milliseconds, a request waits for its reply before {@link onSlowReply} hears of it; defaults to 10 seconds. */
    slowReplyMs?: number;
    /**
     * Called once for each request still waiting for its reply after
     * {@link slowReplyMs}. The request keeps waiting, and a reply that comes
     * later settles it as usual.
     */
    onSlowReply?: (request: ProjprogramRequest) => void;
}

interface PendingRequest {
    resolve: (reply: ProjprogramReply) => void;
    reject: (error: ProjprogramError) => void;
    // fires the slow-reply notice; undefined when no one listens for it
    timer: ReturnType<typeof setTimeout> | undefined;
}

type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;

const DEFAULT_SLOW_REPLY_MS = 10000;

/**
 * Compiles the open project from a simulator extension and receives the
 * program a simulator run of it executes. Each method resolves with the
 * editor's reply, or rejects with a {@link ProjprogramError} carrying the
 * editor's error code.
 *
 * A request waits for its reply however long that takes; a reply slower than
 * {@link ProjprogramClientOptions.slowReplyMs} is reported to
 * {@link ProjprogramClientOptions.onSlowReply} and never fails the request.
 * Only {@link dispose} ends the wait, failing the request with `DISPOSED`. A
 * request that cannot be posted fails at once with `FAILED`, and a request
 * made after {@link dispose} fails at once with `DISPOSED`.
 */
export class ProjprogramClient {
    protected readonly target: ProjprogramTargetWindow;
    protected readonly listener: ProjprogramListenerWindow;
    protected readonly targetOrigin: string;
    protected readonly slowReplyMs: number;
    protected readonly onSlowReply: ((request: ProjprogramRequest) => void) | undefined;
    protected readonly idPrefix = Math.random().toString(36).slice(2);
    protected nextId = 0;
    protected pending: { [id: string]: PendingRequest } = {};
    protected disposed = false;

    constructor(options: ProjprogramClientOptions = {}) {
        this.target = options.target || window.parent;
        this.listener = options.listener || window;
        this.targetOrigin = options.targetOrigin ?? getParentOrigin(options.search) ?? "*";
        this.slowReplyMs = options.slowReplyMs ?? DEFAULT_SLOW_REPLY_MS;
        this.onSlowReply = options.onSlowReply;
        this.listener.addEventListener("message", this.onMessage);
    }

    /**
     * Compiles the open project and resolves with the program a simulator run
     * of it executes. Rejects with `COMPILE_FAILED`, the error's `diagnostics`
     * listing what the compile reported, when the compile produced no program.
     */
    async compile(): Promise<ProjprogramProgram> {
        const reply = await this.requestAsync({ subtype: "compile" }, "program") as ProjprogramProgramReply;
        return { code: reply.code, options: reply.options };
    }

    /**
     * Stops listening for replies, and fails every pending request with
     * `DISPOSED`. Later requests fail with `DISPOSED` without being sent.
     */
    dispose() {
        this.disposed = true;
        this.listener.removeEventListener("message", this.onMessage);
        for (const id of Object.keys(this.pending)) {
            this.settle(id)?.reject(new ProjprogramError("DISPOSED", "The client was disposed before the editor replied."));
        }
    }

    protected requestAsync(body: DistributiveOmit<ProjprogramRequest, "type" | "id">, expected: ProjprogramReply["subtype"]): Promise<ProjprogramReply> {
        const id = `${this.idPrefix}-${this.nextId++}`;
        const request = { ...body, type: PROJPROGRAM_MESSAGE_TYPE, id } as ProjprogramRequest;
        return new Promise<ProjprogramReply>((resolve, reject) => {
            if (this.disposed) {
                reject(new ProjprogramError("DISPOSED", "The client was disposed; the request was not sent."));
                return;
            }
            const onSlowReply = this.onSlowReply;
            const timer = onSlowReply && setTimeout(() => onSlowReply(request), this.slowReplyMs);
            this.pending[id] = { resolve, reject, timer };
            try {
                this.target.postMessage(request, this.targetOrigin);
            } catch (e) {
                this.settle(id);
                reject(new ProjprogramError("FAILED", `The request could not be posted; it was not sent: ${(e as Error)?.message || e}`));
            }
        }).then(reply => {
            if (reply.subtype === "error") throw new ProjprogramError(reply.code, reply.message, reply.diagnostics || []);
            if (reply.subtype !== expected) throw new ProjprogramError("FAILED", `Unexpected ${reply.subtype} reply to a ${body.subtype} request.`);
            return reply;
        });
    }

    protected onMessage = (ev: MessageEvent) => {
        if (ev.source !== this.target) return;
        const message = ev.data as ProjprogramReply;
        if (message?.type !== PROJPROGRAM_MESSAGE_TYPE) return;
        if (typeof message.id !== "string") return;
        this.settle(message.id)?.resolve(message);
    }

    protected settle(id: string): PendingRequest | undefined {
        const request = this.pending[id];
        if (!request) return undefined;
        delete this.pending[id];
        clearTimeout(request.timer);
        return request;
    }
}
