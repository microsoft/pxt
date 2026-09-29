/**
 * The project-file ("projfs") messages a simulator extension exchanges with the
 * editor, and a client that wraps them in promises.
 *
 * A simulator extension sees and changes only its own folder in the project,
 * which the editor names after the extension's key (e.g. `owner/repo`) and
 * identifies from the requesting frame. Requests and replies name files
 * relative to that folder. Within the folder, only the files pxt.json lists
 * are visible; writes list their file. Requests are posted to the editor
 * window; the editor replies to the requesting frame only, with the request's
 * `id`.
 *
 * Writes and deletes come in two classes. By default a change is an artifact:
 * saved with the project, but the editor and a running simulator are left
 * alone. A change flagged `dirty` is treated as a user edit: the editor showing
 * the file shows the new content, the project is typechecked, and the
 * simulator reruns if it runs automatically, just as after the user types.
 *
 * This module has no dependencies; a simulator extension can import or copy it
 * as-is.
 */

export const PROJFS_MESSAGE_TYPE = "projfs";

/**
 * Returns the key the editor created this simulator extension's frame for,
 * e.g. `owner/repo`, which the editor passes in the frame URL's `channel`
 * parameter. The key is the channel the extension's simulator messages
 * carry; use it to filter those messages or to show which extension is
 * running. Projfs requests and replies never include it; a file the
 * extension names `notes.txt` appears in the project as `<key>/notes.txt`.
 * @param channel the key, for an extension that knows it; returned as-is
 * @param search the frame URL's query string; defaults to `window.location.search`
 * @returns the key, or undefined if neither `channel` nor the URL provides one
 */
export function getSimxChannel(channel?: string, search?: string): string | undefined {
    if (channel) return channel;
    const query = search !== undefined ? search : window.location.search;
    return new URLSearchParams(query).get("channel") || undefined;
}

/**
 * Returns the id of the MakeCode target hosting this simulator extension's
 * frame, e.g. `microbit` or `arcade`, which the editor passes in the frame
 * URL's `target` parameter. Use it to adapt what the extension shows to the
 * target it runs in. The value is informational: it grants nothing, and
 * projfs requests and replies never include it.
 * @param search the frame URL's query string; defaults to `window.location.search`
 * @returns the target id, or undefined if the URL provides none
 */
export function getTargetId(search?: string): string | undefined {
    const query = search !== undefined ? search : window.location.search;
    return new URLSearchParams(query).get("target") || undefined;
}

/**
 * Why a request failed. Clients branch on the code; the message that
 * accompanies it is for people.
 */
export type ProjfsErrorCode =
    /**
     * Reads: the extension's folder has no file of that name that pxt.json
     * lists; a stored file pxt.json does not list is reported the same as a
     * missing one. Deletes: the folder neither stores nor lists the file.
     */
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

/** Lists the files in the extension's folder that pxt.json lists. The reply is a {@link ProjfsFilesReply}. */
export interface ProjfsListRequest extends ProjfsMessage {
    subtype: "list";
}

/** Reads a file in the extension's folder that pxt.json lists. The reply is a {@link ProjfsContentReply}. */
export interface ProjfsReadRequest extends ProjfsMessage {
    subtype: "read";
    /** The name relative to the extension's folder, e.g. `notes.txt` or `data/level1.json`. */
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
    /** If present, the write is a user edit rather than an artifact; see {@link ProjfsMutationOptions.dirty}. */
    dirty?: true;
}

/**
 * Deletes a file from the extension's folder and removes it from pxt.json.
 * The reply is a {@link ProjfsAckReply}.
 */
export interface ProjfsDeleteRequest extends ProjfsMessage {
    subtype: "delete";
    /** The name relative to the extension's folder. */
    name: string;
    /** If present, the delete is a user edit rather than an artifact; see {@link ProjfsMutationOptions.dirty}. */
    dirty?: true;
}

export type ProjfsRequest = ProjfsListRequest | ProjfsReadRequest | ProjfsWriteRequest | ProjfsDeleteRequest;

export interface ProjfsFileInfo {
    /** The name relative to the extension's folder. */
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
    /** The name the request gave, relative to the extension's folder. */
    name: string;
    content: string;
}

export interface ProjfsAckReply extends ProjfsMessage {
    subtype: "ack";
    /** The name the request gave, relative to the extension's folder; `read` and `delete` accept it. */
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

/** How a {@link ProjfsClient} write or delete changes the project. */
export interface ProjfsMutationOptions {
    /**
     * If true, the change dirties the project as a user edit would: the editor
     * showing the file shows the new content, the project is typechecked, and
     * the simulator reruns if it runs automatically. Several dirty changes in
     * quick succession lead to one rerun. Blocks the change defines reach the
     * toolbox the next time the toolbox loads, as after the user types them.
     * Replacing the file the text editor shows resets its undo history and
     * cursor.
     *
     * If false or absent, the change is an artifact: it is saved with the
     * project, and neither the editor nor a running simulator notices it until
     * the project is next loaded or run.
     */
    dirty?: boolean;
}

interface PendingRequest {
    resolve: (reply: ProjfsReply) => void;
    reject: (error: ProjfsError) => void;
    timer: ReturnType<typeof setTimeout>;
}

type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;

const DEFAULT_TIMEOUT_MS = 10000;

/** Returns the `dirty` field a request carries for `options`: present only for a dirty change. */
function dirtyField(options: ProjfsMutationOptions | undefined): { dirty?: true } {
    return options?.dirty ? { dirty: true } : {};
}

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

    /** Lists the files in this extension's folder that pxt.json lists, by names relative to the folder. */
    async list(): Promise<ProjfsFileInfo[]> {
        const reply = await this.requestAsync({ subtype: "list" }, "files") as ProjfsFilesReply;
        return reply.files;
    }

    /**
     * Reads a file in this extension's folder that pxt.json lists.
     * @param name the name relative to the extension's folder
     */
    async read(name: string): Promise<string> {
        const reply = await this.requestAsync({ subtype: "read", name }, "content") as ProjfsContentReply;
        return reply.content;
    }

    /**
     * Creates or replaces a file in this extension's folder.
     * @param name the name relative to the extension's folder
     * @param content text, or binary data as a `data:<mime type>;base64,` URI
     * @param options whether the write is a user edit or an artifact (the default)
     * @returns `name`, which `read` and `delete` accept
     */
    async write(name: string, content: string, options?: ProjfsMutationOptions): Promise<string> {
        const reply = await this.requestAsync({ subtype: "write", name, content, ...dirtyField(options) }, "ack") as ProjfsAckReply;
        return reply.name;
    }

    /**
     * Deletes a file from this extension's folder.
     * @param name the name relative to the extension's folder
     * @param options whether the delete is a user edit or an artifact (the default)
     * @returns `name`
     */
    async delete(name: string, options?: ProjfsMutationOptions): Promise<string> {
        const reply = await this.requestAsync({ subtype: "delete", name, ...dirtyField(options) }, "ack") as ProjfsAckReply;
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
