import {
    PROJFS_MESSAGE_TYPE,
    ProjfsDeleteRequest,
    ProjfsErrorCode,
    ProjfsFileInfo,
    ProjfsReply,
    ProjfsRequest,
    ProjfsWriteRequest,
} from "../../pxtservices/projfs";

/** The most UTF-8 bytes the files under one simulator extension's folder may hold. */
export const PROJFS_SCOPE_QUOTA_BYTES = 512 * 1024;

/** The most writes and deletes one simulator extension may make within {@link PROJFS_RATE_WINDOW_MS}. */
export const PROJFS_RATE_LIMIT = 30;

/** The sliding window, in milliseconds, over which {@link PROJFS_RATE_LIMIT} applies. */
export const PROJFS_RATE_WINDOW_MS = 10000;

/** The open project, as the projfs host reads and changes it. */
export interface ProjfsProject {
    /** Every file stored in the project, keyed by name, whether or not pxt.json lists it. */
    getFiles(): pxt.Map<string>;
    /** Creates or replaces a stored file. Leaves pxt.json unchanged. */
    writeFileAsync(name: string, content: string): Promise<void>;
    /** Deletes a stored file. Leaves pxt.json unchanged. */
    deleteFileAsync(name: string): Promise<void>;
    /** Adds `name` to the "files" list of pxt.json, or removes it from the "files" and "testFiles" lists. */
    setListedAsync(name: string, listed: boolean): Promise<void>;
    /**
     * Passes a change just made to the stored file `name` through the editor's
     * user-edit pipeline, as {@link applyUserEdit} does. Called after a write or
     * delete a simulator extension flags `dirty`; absent where no editor takes
     * user edits, in which case flagged changes apply as artifacts.
     * @param content the file's new content, or undefined if it was deleted
     */
    markDirty?(name: string, content: string | undefined): void;
}

/** The editor entry points a user edit passes through, as {@link applyUserEdit} uses them. */
export interface ProjfsEditor {
    /** Returns true if the editor is showing the project file `name`. */
    isOpenFile(name: string): boolean;
    /** Returns true if the text editor is the active editor. */
    isTextEditor(): boolean;
    /** Returns true if the blocks editor is the active editor. */
    isBlocksEditor(): boolean;
    /** Replaces the text editor's content, which the editor handles as a change the user made. */
    overrideTypescriptFile(text: string): void;
    /** Replaces the blocks editor's content, which the editor handles as a change the user made. */
    overrideBlocksFile(text: string): void;
    /** Marks the simulator as running outdated code. */
    setSimulatorDirty(): void;
    /** Saves the open file and schedules a typecheck, after which the simulator reruns if it runs automatically. */
    typecheckNow(): void;
}

/**
 * Makes a change already saved to the project file `name` take effect as a user
 * edit would, through the same editor entry points. The editor showing the
 * file shows `content`; replacing the text editor's content resets its undo
 * history and cursor. The simulator is marked as running outdated code, and a
 * typecheck is scheduled; the editor's own debouncing merges the typechecks,
 * and so the reruns, of changes that arrive in quick succession. The toolbox
 * is left alone and picks up new blocks the next time it loads.
 * @param content the file's new content, or undefined if it was deleted
 */
export function applyUserEdit(editor: ProjfsEditor, name: string, content: string | undefined): void {
    if (content !== undefined && editor.isOpenFile(name)) {
        if (editor.isTextEditor()) editor.overrideTypescriptFile(content);
        else if (editor.isBlocksEditor()) editor.overrideBlocksFile(content);
    }
    editor.setSimulatorDirty();
    editor.typecheckNow();
}

/** Returns the size of `content` in UTF-8 bytes. */
export function utf8Length(content: string): number {
    return new TextEncoder().encode(content).length;
}

/**
 * Returns true if `name` is a relative path whose segments, split at `/` and `\`,
 * are all non-empty and none is `.` or `..`.
 */
export function isValidRelativeName(name: unknown): name is string {
    return typeof name === "string"
        && name.split(/[\/\\]/).every(segment => segment && segment !== "." && segment !== "..");
}

/**
 * Returns the project name of the file `name` in the folder `scope`, or undefined
 * if `name` is not a valid relative name or the result would fall under `pxt_modules/`.
 * @param scope the simulator extension's key, e.g. `owner/repo`
 */
export function getScopedName(scope: string, name: unknown): string | undefined {
    if (!isValidRelativeName(name)) return undefined;
    const scoped = `${scope}/${name}`;
    if (!isValidRelativeName(scoped) || scoped.startsWith("pxt_modules/")) return undefined;
    return scoped;
}

/** Returns the names listed in the "files" list of the project's pxt.json. */
export function getListedFiles(files: pxt.Map<string>): string[] {
    const config = pxt.Util.jsonTryParse(files[pxt.CONFIG_NAME]) as pxt.PackageConfig;
    return Array.isArray(config?.files)
        ? config.files.filter(name => typeof name === "string")
        : [];
}

/**
 * Returns the files in the folder `scope` that are both stored and listed in
 * pxt.json, in listed order, with their sizes. Names are relative to `scope`,
 * and each is a valid relative name.
 * @param scope the simulator extension's key, e.g. `owner/repo`
 */
export function getVisibleFiles(files: pxt.Map<string>, scope: string): ProjfsFileInfo[] {
    const prefix = scope + "/";
    return getListedFiles(files)
        .filter(name => name.startsWith(prefix) && Object.prototype.hasOwnProperty.call(files, name))
        .map(name => name.slice(prefix.length))
        .filter(isValidRelativeName)
        .map(name => ({ name, size: utf8Length(files[prefix + name]) }));
}

/** Returns the total size, in UTF-8 bytes, of the stored files under the folder `scope`. */
export function getScopeUsage(files: pxt.Map<string>, scope: string): number {
    const prefix = scope + "/";
    return Object.keys(files)
        .filter(name => name.startsWith(prefix))
        .reduce((total, name) => total + utf8Length(files[name]), 0);
}

class ProjfsRequestError extends Error {
    constructor(public readonly code: ProjfsErrorCode, message: string) {
        super(message);
    }
}

/**
 * Serves the project-file requests of simulator extensions. Each extension
 * lists, reads, writes and deletes files in the folder named by its key, by
 * names relative to that folder; within the folder it lists and reads only the
 * files pxt.json lists. Requests apply one at a time, in the order they arrive.
 * Writes and deletes are artifacts unless flagged `dirty`, in which case they
 * also pass through {@link ProjfsProject.markDirty} once applied.
 */
export class ProjfsHost {
    protected queue: Promise<void> = Promise.resolve();
    protected recentMutations: pxt.Map<number[]> = {};

    /**
     * @param getProject returns the open project, or undefined if none is open
     * @param now returns the current time in milliseconds
     */
    constructor(
        protected readonly getProject: () => ProjfsProject | undefined,
        protected readonly now: () => number = () => Date.now()
    ) {
    }

    /**
     * Applies a request from the simulator extension with the given key, after
     * those already received, and sends it one reply.
     * @param key the extension key the requesting frame was created for
     * @param msg the request, as received
     * @param reply delivers a reply to the requesting frame
     * @returns a promise that resolves once the reply is sent
     */
    handleMessageAsync(key: string, msg: unknown, reply: (msg: ProjfsReply) => void): Promise<void> {
        const request = msg as ProjfsRequest;
        const id = typeof request?.id === "string" ? request.id : undefined;
        const sendError = (code: ProjfsErrorCode, message: string) =>
            reply({ type: PROJFS_MESSAGE_TYPE, id, subtype: "error", code, message });

        const mutates = request?.subtype === "write" || request?.subtype === "delete";
        if (mutates && !this.admitMutation(key)) {
            sendError("RATE_LIMITED", `More than ${PROJFS_RATE_LIMIT} writes and deletes in ${PROJFS_RATE_WINDOW_MS / 1000} seconds.`);
            return this.queue;
        }

        this.queue = this.queue
            .then(() => this.applyAsync(key, request))
            .then(
                result => reply({ ...result, type: PROJFS_MESSAGE_TYPE, id }),
                e => e instanceof ProjfsRequestError
                    ? sendError(e.code, e.message)
                    : sendError("FAILED", e?.message || String(e)))
            .catch(e => pxt.reportException(e));
        return this.queue;
    }

    protected admitMutation(key: string): boolean {
        const now = this.now();
        const recent = (this.recentMutations[key] || []).filter(t => now - t < PROJFS_RATE_WINDOW_MS);
        const admitted = recent.length < PROJFS_RATE_LIMIT;
        if (admitted) recent.push(now);
        this.recentMutations[key] = recent;
        return admitted;
    }

    protected async applyAsync(scope: string, request: ProjfsRequest): Promise<ProjfsReplyBody> {
        const project = this.getProject();
        if (!project) throw new ProjfsRequestError("FAILED", "No project is open.");
        const files = project.getFiles();

        switch (request?.subtype) {
            case "list":
                return { subtype: "files", files: getVisibleFiles(files, scope) };

            case "read": {
                const { name } = request;
                const scoped = this.scopedNameOrThrow(scope, name);
                if (!getVisibleFiles(files, scope).some(f => f.name === name))
                    throw new ProjfsRequestError("NOT_FOUND", `${name} is not a file in ${scope}/.`);
                return { subtype: "content", name, content: files[scoped] };
            }

            case "write": {
                const { content } = request;
                if (typeof content !== "string")
                    throw new ProjfsRequestError("INVALID_REQUEST", "The content must be a string.");
                const dirty = this.dirtyOrThrow(request);
                const name = this.scopedNameOrThrow(scope, request.name);
                const replaced = Object.prototype.hasOwnProperty.call(files, name) ? utf8Length(files[name]) : 0;
                const usage = getScopeUsage(files, scope);
                const total = usage - replaced + utf8Length(content);
                if (total > PROJFS_SCOPE_QUOTA_BYTES)
                    throw new ProjfsRequestError("QUOTA_EXCEEDED",
                        `Writing ${name} would bring ${scope}/ to ${total} bytes; it holds ${usage} of ${PROJFS_SCOPE_QUOTA_BYTES}.`);
                await project.writeFileAsync(name, content);
                if (getListedFiles(files).indexOf(name) < 0)
                    await project.setListedAsync(name, true);
                if (dirty) project.markDirty?.(name, content);
                return { subtype: "ack", name: request.name };
            }

            case "delete": {
                const dirty = this.dirtyOrThrow(request);
                const name = this.scopedNameOrThrow(scope, request.name);
                const stored = Object.prototype.hasOwnProperty.call(files, name);
                const listed = getListedFiles(files).indexOf(name) >= 0;
                if (!stored && !listed)
                    throw new ProjfsRequestError("NOT_FOUND", `${name} does not exist.`);
                if (stored)
                    await project.deleteFileAsync(name);
                if (listed)
                    await project.setListedAsync(name, false);
                if (dirty) project.markDirty?.(name, undefined);
                return { subtype: "ack", name: request.name };
            }

            default:
                throw new ProjfsRequestError("INVALID_REQUEST", `Unknown request ${(request as any)?.subtype}.`);
        }
    }

    protected dirtyOrThrow(request: ProjfsWriteRequest | ProjfsDeleteRequest): boolean {
        const dirty: unknown = request.dirty;
        if (dirty !== undefined && typeof dirty !== "boolean")
            throw new ProjfsRequestError("INVALID_REQUEST", "The dirty flag must be true or false.");
        return dirty === true;
    }

    protected scopedNameOrThrow(scope: string, name: unknown): string {
        const scoped = getScopedName(scope, name);
        if (!scoped)
            throw new ProjfsRequestError("INVALID_NAME", `${name} is not a valid relative file name.`);
        return scoped;
    }
}

/** A reply without the `type` and `id` fields every reply carries. */
type ProjfsReplyBody<R = ProjfsReply> = R extends ProjfsReply ? Omit<R, "type" | "id"> : never;
