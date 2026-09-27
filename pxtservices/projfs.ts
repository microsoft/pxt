/**
 * The project-file ("projfs") messages a simulator extension exchanges with the
 * editor, and a client that wraps them in promises.
 *
 * A simulator extension reads the files its project's pxt.json lists and writes
 * files under its own folder, which the editor names after the extension's key
 * (e.g. `owner/repo`). Requests are posted to the editor window; the editor
 * replies to the requesting frame only, with the request's `id`.
 *
 * This module has no dependencies; a simulator extension can import or copy it
 * as-is.
 */

export const PROJFS_MESSAGE_TYPE = "projfs";

/**
 * Why a request failed. Clients branch on the code; the message that
 * accompanies it is for people.
 */
export type ProjfsErrorCode =
    /** The file is not listed in pxt.json (reads), or is neither stored nor listed in the extension's folder (deletes). */
    | "NOT_FOUND"
    /** The write would take the extension's folder over its size limit; nothing was written. */
    | "QUOTA_EXCEEDED"
    /** The name is not a relative path, or has an empty, `.` or `..` segment. */
    | "INVALID_NAME"
    /** The extension sent too many writes and deletes in a short time; the request was not applied. */
    | "RATE_LIMITED"
    /** The request is malformed. */
    | "INVALID_REQUEST"
    /** The editor could not complete the request, for instance because no project is open. */
    | "FAILED"
    /** The editor did not reply in time (raised by the client). */
    | "TIMEOUT";

interface ProjfsMessage {
    type: "projfs";
    /** Chosen by the requester; the reply carries the same `id`. */
    id: string;
}

/** Lists the files the project's pxt.json lists. The reply is a {@link ProjfsFilesReply}. */
export interface ProjfsListRequest extends ProjfsMessage {
    subtype: "list";
}

/** Reads a file the project's pxt.json lists. The reply is a {@link ProjfsContentReply}. */
export interface ProjfsReadRequest extends ProjfsMessage {
    subtype: "read";
    /** The name as pxt.json lists it, e.g. `main.ts` or `owner/repo/notes.txt`. */
    name: string;
}

/**
 * Creates or replaces a file in the extension's folder and lists it in pxt.json.
 * The reply is a {@link ProjfsAckReply}.
 */
export interface ProjfsWriteRequest extends ProjfsMessage {
    subtype: "write";
    /** The name relative to the extension's folder, e.g. `notes.txt` or `data/level1.json`. */
    name: string;
    /** Text, or binary data as a `data:<mime type>;base64,` URI. */
    content: string;
}

/**
 * Deletes a file from the extension's folder and removes it from pxt.json.
 * The reply is a {@link ProjfsAckReply}.
 */
export interface ProjfsDeleteRequest extends ProjfsMessage {
    subtype: "delete";
    /** The name relative to the extension's folder. */
    name: string;
}

export type ProjfsRequest = ProjfsListRequest | ProjfsReadRequest | ProjfsWriteRequest | ProjfsDeleteRequest;

export interface ProjfsFileInfo {
    /** The name as pxt.json lists it. */
    name: string;
    /** Size of the stored content in UTF-8 bytes; a `data:` URI counts at its encoded length. */
    size: number;
}

export interface ProjfsFilesReply extends ProjfsMessage {
    subtype: "files";
    files: ProjfsFileInfo[];
}

export interface ProjfsContentReply extends ProjfsMessage {
    subtype: "content";
    name: string;
    content: string;
}

export interface ProjfsAckReply extends ProjfsMessage {
    subtype: "ack";
    /** The project name of the file written or deleted, e.g. `owner/repo/notes.txt`. */
    name: string;
}

export interface ProjfsErrorReply extends ProjfsMessage {
    subtype: "error";
    code: ProjfsErrorCode;
    message: string;
}

export type ProjfsReply = ProjfsFilesReply | ProjfsContentReply | ProjfsAckReply | ProjfsErrorReply;

/** A refused or unanswered request. */
export class ProjfsError extends Error {
    constructor(public readonly code: ProjfsErrorCode, message: string) {
        super(message);
        this.name = "ProjfsError";
        // keeps instanceof working when compiled to ES5
        Object.setPrototypeOf(this, ProjfsError.prototype);
    }
}

/** The window a {@link ProjfsClient} posts requests to. */
export interface ProjfsTargetWindow {
    postMessage(message: any, targetOrigin: string): void;
}

/** The window a {@link ProjfsClient} receives replies on. */
export interface ProjfsListenerWindow {
    addEventListener(type: "message", listener: (ev: MessageEvent) => void): void;
    removeEventListener(type: "message", listener: (ev: MessageEvent) => void): void;
}

export interface ProjfsClientOptions {
    /** The editor window; defaults to `window.parent`. Replies from any other window are ignored. */
    target?: ProjfsTargetWindow;
    /** The window replies arrive on; defaults to `window`. */
    listener?: ProjfsListenerWindow;
    /** The origin requests may be delivered to; defaults to `"*"`. */
    targetOrigin?: string;
    /** How long to wait for each reply before failing with `TIMEOUT`; defaults to 10 seconds. */
    timeoutMs?: number;
}

interface PendingRequest {
    resolve: (reply: ProjfsReply) => void;
    reject: (error: ProjfsError) => void;
    timer: ReturnType<typeof setTimeout>;
}

type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;

const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Reads and writes project files from a simulator extension. Each method
 * resolves with the editor's reply, or rejects with a {@link ProjfsError}
 * carrying the editor's error code.
 */
export class ProjfsClient {
    protected readonly target: ProjfsTargetWindow;
    protected readonly listener: ProjfsListenerWindow;
    protected readonly targetOrigin: string;
    protected readonly timeoutMs: number;
    protected readonly idPrefix = Math.random().toString(36).slice(2);
    protected nextId = 0;
    protected pending: { [id: string]: PendingRequest } = {};

    constructor(options: ProjfsClientOptions = {}) {
        this.target = options.target || window.parent;
        this.listener = options.listener || window;
        this.targetOrigin = options.targetOrigin || "*";
        this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
        this.listener.addEventListener("message", this.onMessage);
    }

    /** Lists the files the project's pxt.json lists. */
    async list(): Promise<ProjfsFileInfo[]> {
        const reply = await this.requestAsync({ subtype: "list" }, "files") as ProjfsFilesReply;
        return reply.files;
    }

    /**
     * Reads a file the project's pxt.json lists.
     * @param name the name as pxt.json lists it
     */
    async read(name: string): Promise<string> {
        const reply = await this.requestAsync({ subtype: "read", name }, "content") as ProjfsContentReply;
        return reply.content;
    }

    /**
     * Creates or replaces a file in this extension's folder.
     * @param name the name relative to the extension's folder
     * @param content text, or binary data as a `data:<mime type>;base64,` URI
     * @returns the file's project name, as `read` and `list` use it
     */
    async write(name: string, content: string): Promise<string> {
        const reply = await this.requestAsync({ subtype: "write", name, content }, "ack") as ProjfsAckReply;
        return reply.name;
    }

    /**
     * Deletes a file from this extension's folder.
     * @param name the name relative to the extension's folder
     * @returns the deleted file's project name
     */
    async delete(name: string): Promise<string> {
        const reply = await this.requestAsync({ subtype: "delete", name }, "ack") as ProjfsAckReply;
        return reply.name;
    }

    /** Stops listening for replies and fails every pending request with `FAILED`. */
    dispose() {
        this.listener.removeEventListener("message", this.onMessage);
        for (const id of Object.keys(this.pending)) {
            this.settle(id)?.reject(new ProjfsError("FAILED", "The client was disposed."));
        }
    }

    protected requestAsync(body: DistributiveOmit<ProjfsRequest, "type" | "id">, expected: ProjfsReply["subtype"]): Promise<ProjfsReply> {
        const id = `${this.idPrefix}-${this.nextId++}`;
        const request = { ...body, type: PROJFS_MESSAGE_TYPE, id } as ProjfsRequest;
        return new Promise<ProjfsReply>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.settle(id)?.reject(new ProjfsError("TIMEOUT", `No reply to the ${body.subtype} request.`));
            }, this.timeoutMs);
            this.pending[id] = { resolve, reject, timer };
            this.target.postMessage(request, this.targetOrigin);
        }).then(reply => {
            if (reply.subtype === "error") throw new ProjfsError(reply.code, reply.message);
            if (reply.subtype !== expected) throw new ProjfsError("FAILED", `Unexpected ${reply.subtype} reply to a ${body.subtype} request.`);
            return reply;
        });
    }

    protected onMessage = (ev: MessageEvent) => {
        if (ev.source !== this.target) return;
        const reply = ev.data as ProjfsReply;
        if (reply?.type !== PROJFS_MESSAGE_TYPE || typeof reply.id !== "string") return;
        this.settle(reply.id)?.resolve(reply);
    }

    protected settle(id: string): PendingRequest | undefined {
        const request = this.pending[id];
        if (!request) return undefined;
        delete this.pending[id];
        clearTimeout(request.timer);
        return request;
    }
}
