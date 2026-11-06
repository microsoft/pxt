/// <reference path="../../built/pxtsim.d.ts" />

import {
    PROJPROGRAM_MESSAGE_TYPE,
    ProjprogramDiagnostic,
    ProjprogramErrorCode,
    ProjprogramReply,
    ProjprogramRequest,
    ProjprogramRunOptions,
} from "../../pxtservices/projprogram";
import {
    caughtErrorReply,
    errorReply,
    getSimxRepository,
    loadedOpenProjectAsync,
    openProjectOrThrow,
    requestId,
    SimxReplyBody,
    SimxRequestError,
} from "./simxRequests";

/**
 * The most compiles for the frames of one GitHub repository's simulator
 * extensions admitted within any {@link PROJPROGRAM_RATE_WINDOW_MS}; later ones
 * wait for the window to admit them.
 */
export const PROJPROGRAM_RATE_LIMIT = 5;

/** The sliding window, in milliseconds, over which {@link PROJPROGRAM_RATE_LIMIT} applies. */
export const PROJPROGRAM_RATE_WINDOW_MS = 10000;

/**
 * The open project as the program host waits on it. The host tells projects
 * apart by identity: one object stands for the project from the time it opens
 * until it closes.
 */
export interface ProjprogramOpenProject {
    /**
     * Returns a promise that resolves once the project has loaded, and
     * rejects if its load fails. It settles even if the project is replaced
     * while loading.
     */
    loadedAsync(): Promise<void>;
}

/** The program a simulator run of the open project executes. */
export interface ProjprogramBuild {
    /** The program's JavaScript. */
    code: string;
    /** The run options the editor passes the simulator driver with `code`. */
    options: pxsim.SimulatorRunOptions;
}

/** What a compile of the open project produced: its program, or the compile result that holds no simulator JavaScript. */
export type ProjprogramCompileOutcome = ProjprogramBuild | { failed: pxtc.CompileResult };

/**
 * Returns the diagnostics of `result` as a `COMPILE_FAILED` reply lists them,
 * in the result's order.
 */
export function getProgramDiagnostics(result: pxtc.CompileResult): ProjprogramDiagnostic[] {
    return (result.diagnostics || []).map(d => {
        const diagnostic: ProjprogramDiagnostic = {
            code: d.code,
            category: ts.pxtc.DiagnosticCategory[d.category].toLowerCase() as ProjprogramDiagnostic["category"],
            message: ts.pxtc.flattenDiagnosticMessageText(d.messageText, "\n"),
        };
        if (d.fileName) diagnostic.fileName = d.fileName;
        if (typeof d.line === "number") diagnostic.line = d.line;
        if (typeof d.column === "number") diagnostic.column = d.column;
        return diagnostic;
    });
}

// the queue key of the lane every compile runs in, one at a time; never a
// repository, since every repository holds a "/"
const COMPILE_LANE = "compile";

/**
 * Serves the compiled-program requests of simulator extensions: compiles the
 * open project and replies with the program a simulator run of it executes,
 * or with `COMPILE_FAILED` and the compile's diagnostics when the compile
 * produces no program. Every request gets one reply.
 *
 * The requests of the extensions of one GitHub repository, `owner/repo` in
 * any letter case, whatever subfolder their keys name, wait in one queue and
 * are answered in the order they arrive; a request whose key names no
 * repository is refused with `UNREGISTERED` at once. One compile runs at a
 * time, whichever repository asked for it, and each request gets a compile of
 * its own, started once the compiles before it have finished. At most
 * {@link PROJPROGRAM_RATE_LIMIT} compiles for one repository are admitted
 * within any {@link PROJPROGRAM_RATE_WINDOW_MS}; later ones wait, with the
 * requests behind them, until the window admits them. An admitted compile
 * then waits for the compiles before it to finish, so it may start after its
 * window.
 *
 * A request applies to the project open when it arrives, once that project
 * has loaded. If that project fails to load, or has closed by the time its
 * compile starts or finishes, the request is refused with `PROJECT_CLOSED`,
 * and the program of a compile that finishes after its project closed is
 * never sent.
 */
export class ProjprogramHost {
    // per repository: the requests received from it, each until it has been
    // answered; and, under COMPILE_LANE, the compiles of every repository, each while it runs
    protected readonly queue = new pxt.Util.PromiseQueue();
    // per repository: admits each compile under the rate limit
    protected readonly compiles: pxt.Util.SlidingWindowAdmission;

    /**
     * @param getOpenProject returns the open project, or undefined if none is open
     * @param compile compiles the open project and returns its program, or
     * the compile result if the compile produced no simulator JavaScript;
     * called only while the project a request arrived in is open and loaded
     * @param now returns the current time in milliseconds on a clock that never
     * goes back; defaults to `pxt.Util.monotonicNow`
     * @param delay returns a promise that resolves after the given number of milliseconds
     */
    constructor(
        protected readonly getOpenProject: () => ProjprogramOpenProject | undefined,
        protected readonly compile: () => Promise<ProjprogramCompileOutcome>,
        protected readonly now: () => number = pxt.Util.monotonicNow,
        protected readonly delay: (ms: number) => Promise<void> = ms => pxt.Util.delay(ms)
    ) {
        this.compiles = new pxt.Util.SlidingWindowAdmission(PROJPROGRAM_RATE_LIMIT, PROJPROGRAM_RATE_WINDOW_MS, now, delay);
    }

    /**
     * Queues a request from the simulator extension with the given key behind
     * those already received from its repository, binds it to the project
     * open now, and sends it one reply once its compile has finished or it
     * has been refused.
     * @param key the extension key the requesting frame was created for
     * @param msg the request, as received
     * @param reply delivers the reply to the requesting frame
     * @returns a promise that resolves once the reply is sent
     */
    handleMessageAsync(key: string, msg: unknown, reply: (msg: ProjprogramReply) => void): Promise<void> {
        const request = msg as ProjprogramRequest;
        const id = requestId(msg);

        const repository = getSimxRepository(key);
        if (repository === undefined) {
            reply(errorReply(PROJPROGRAM_MESSAGE_TYPE, id, "UNREGISTERED", `${key} names no GitHub repository.`));
            return Promise.resolve();
        }

        const open = this.getOpenProject();
        return this.queue.enqueue(repository, async () => {
            let answer: ProjprogramReply;
            try {
                answer = { ...await this.applyAsync(repository, request, open), type: PROJPROGRAM_MESSAGE_TYPE, id } as ProjprogramReply;
            } catch (e) {
                answer = caughtErrorReply<typeof PROJPROGRAM_MESSAGE_TYPE, ProjprogramErrorCode>(PROJPROGRAM_MESSAGE_TYPE, id, e);
            }
            reply(answer);
        }).catch(e => pxt.reportException(e));
    }

    /**
     * Compiles `open` for `request` once it has loaded and the rate limit and
     * the compile lane admit it, and returns the reply's body.
     * @param open the project open when the request arrived
     */
    protected async applyAsync(repository: string, request: ProjprogramRequest, open: ProjprogramOpenProject | undefined): Promise<SimxReplyBody<ProjprogramReply>> {
        if (request?.subtype !== "compile")
            throw new SimxRequestError<ProjprogramErrorCode>("INVALID_REQUEST", `Unknown request ${(request as any)?.subtype}.`);
        const getOpen = () => this.getOpenProject();
        const loaded = await loadedOpenProjectAsync(open, getOpen);
        await this.compiles.admitAsync(repository, () => openProjectOrThrow(loaded, getOpen));
        const outcome = await this.queue.enqueue(COMPILE_LANE, async () => {
            openProjectOrThrow(loaded, getOpen);
            return this.compile();
        }).finally(() => {
            // a project that closed while it compiled refuses the request, whatever the compile did
            openProjectOrThrow(loaded, getOpen);
        });
        if ("failed" in outcome) {
            return {
                subtype: "error",
                code: "COMPILE_FAILED",
                message: "The compile produced no simulator program.",
                diagnostics: getProgramDiagnostics(outcome.failed),
            };
        }
        return { subtype: "program", code: outcome.code, options: outcome.options as ProjprogramRunOptions };
    }
}
