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

/**
 * The most writes and deletes of one simulator extension that apply within
 * {@link PROJFS_RATE_WINDOW_MS}; later ones wait for the window to allow them.
 */
export const PROJFS_RATE_LIMIT = 30;

/** The sliding window, in milliseconds, over which {@link PROJFS_RATE_LIMIT} applies. */
export const PROJFS_RATE_WINDOW_MS = 10000;

/**
 * The most writes and deletes of one simulator extension that may wait for
 * replies at once; more are refused with `RATE_LIMITED`.
 */
export const PROJFS_MAX_PENDING_MUTATIONS = 1000;

/**
 * The open project, as the projfs host reads and changes it. The host tells
 * projects apart by identity: one object stands for the project from the time
 * it opens until it closes, and reopening a project yields a new object.
 */
export interface ProjfsProject {
    /** Every file stored in the project, keyed by name, whether or not pxt.json lists it. */
    getFiles(): pxt.Map<string>;
    /** Creates or replaces a stored file; a text editor showing the file shows the new content. Leaves pxt.json unchanged. */
    writeFileAsync(name: string, content: string): Promise<void>;
    /** Deletes a stored file. Leaves pxt.json unchanged. */
    deleteFileAsync(name: string): Promise<void>;
    /**
     * Adds `name` to the "files" list of pxt.json, or removes it from the
     * "files" and "testFiles" lists. Rejects if pxt.json cannot be changed.
     */
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

/** A stored file of the editor package, as {@link writeProjectFileAsync} changes it. */
export interface ProjfsPackageFile {
    /**
     * Replaces the file's content and saves it.
     * @param force if true, the text editor reloads the file it shows, and
     * the promise settles once it has
     */
    setContentAsync(content: string, force?: boolean): Promise<void>;
}

/** The editor package, as {@link writeProjectFileAsync} changes it. */
export interface ProjfsPackage {
    /** The package's stored files, keyed by name. */
    files: pxt.Map<ProjfsPackageFile>;
    /** Adds a stored file holding `content`, without saving it. */
    setFile(name: string, content: string): void;
    /** Saves the stored file `name`. */
    saveFileAsync(name: string): Promise<void>;
}

// PR NOTE [Issue 1] -- lift into the PR description, then remove.
// This is the fix for Issue 1 (generated-docs/pxt-issue-drafts: programmatic
// writes behind the open text editor reverted by save-back). The write forces
// EXACTLY when the written file is the one the text editor shows: forcing
// reloads the editor so the stale buffer cannot be saved back over the write,
// and NOT forcing for any other file keeps an unrelated write from destroying
// unsaved typing in the shown file (the editor's reload callback reloads the
// shown file, not the written one). The promise settling only after the
// editor shows the content is the companion fix for Issue 2 (the
// save-debounce race; see the PR notes in package.ts, app.tsx, monaco.tsx).
/**
 * Creates or replaces the stored file `name` of `epkg` and saves it. If the
 * text editor shows the file, it reloads to show `content`, which replaces any
 * change not yet saved from it and resets its undo history and cursor; the
 * promise then settles once the editor shows `content`.
 * @param editor the editor showing the project, or undefined if there is none
 */
export function writeProjectFileAsync(epkg: ProjfsPackage, editor: ProjfsEditor | undefined, name: string, content: string): Promise<void> {
    const file = epkg.files[name];
    if (!file) {
        epkg.setFile(name, content);
        return epkg.saveFileAsync(name);
    }
    return file.setContentAsync(content, !!editor && editor.isOpenFile(name) && editor.isTextEditor());
}

/** The editor package, as {@link setFileListedAsync} changes its pxt.json. */
export interface ProjfsConfigPackage {
    /**
     * Passes the parsed pxt.json to `update`, then saves it as `update` left
     * it. Returns null, saving nothing, if pxt.json is missing or malformed or
     * `update` throws.
     */
    updateConfigAsync(update: (config: pxt.PackageConfig) => void): Promise<void> | null;
}

// PR NOTE [Issue 3] -- lift into the PR description, then remove.
// This is the consumer-side fix for Issue 3 (generated-docs/pxt-issue-drafts:
// updateConfigAsync returns null on failure, so a failed pxt.json update
// reads as success). Before, the null return was coerced into a resolved
// promise: the file stayed stored but unlisted while the requester was acked,
// later reads reported it absent, and its bytes still counted against the
// scope quota. Rejecting here makes the request answer FAILED; the file
// remains stored, so a retry of the listing completes the operation. The
// issue's fix direction (updateConfigAsync itself rejecting on failure)
// would land upstream; this call site stays correct either way.
/**
 * Adds `name` to the "files" list of the pxt.json of `epkg`, or removes it
 * from the "files" and "testFiles" lists, and saves pxt.json. Rejects if
 * pxt.json cannot be changed.
 */
export function setFileListedAsync(epkg: ProjfsConfigPackage, name: string, listed: boolean): Promise<void> {
    return epkg.updateConfigAsync(config => {
        if (listed) {
            if (config.files.indexOf(name) < 0) config.files.push(name);
        } else {
            config.files = config.files.filter(f => f !== name);
            if (config.testFiles) config.testFiles = config.testFiles.filter(f => f !== name);
        }
    }) || Promise.reject(new Error(`pxt.json could not be updated to ${listed ? "list" : "unlist"} ${name}.`));
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
 * files pxt.json lists.
 *
 * Every request gets one reply, sent once it has applied or been refused. One
 * request applies at a time, and each extension's requests apply in the order
 * they arrive. An extension's writes and deletes beyond
 * {@link PROJFS_RATE_LIMIT} within {@link PROJFS_RATE_WINDOW_MS} wait, with
 * the requests behind them, until the window allows them. A request applies
 * only to the project open when it arrived; if that project has closed by the
 * time the request's turn comes, it is refused with `PROJECT_CLOSED`, and a
 * request that has begun applying completes in the project it began in.
 *
 * Writes and deletes are artifacts unless flagged `dirty`, in which case they
 * also pass through {@link ProjfsProject.markDirty} once applied.
 */
export class ProjfsHost {
    // per extension key: settles once every request received from the extension has been answered
    protected tails: pxt.Map<Promise<void>> = {};
    // settles once the request applying now, whichever extension sent it, has finished
    protected applying: Promise<void> = Promise.resolve();
    // per extension key: when each write and delete within the rate window began to apply
    protected recentMutations: pxt.Map<number[]> = {};
    // per extension key: how many writes and deletes have been received and not yet answered
    protected pendingMutations: pxt.Map<number> = {};

    /**
     * @param getProject returns the open project, or undefined if none is open
     * @param now returns the current time in milliseconds
     * @param delay returns a promise that resolves after the given number of milliseconds
     */
    constructor(
        protected readonly getProject: () => ProjfsProject | undefined,
        protected readonly now: () => number = () => Date.now(),
        protected readonly delay: (ms: number) => Promise<void> = ms => pxt.Util.delay(ms)
    ) {
    }

    /**
     * Queues a request from the simulator extension with the given key behind
     * those already received from it, binds it to the project open now, and
     * sends it one reply once it has applied or been refused.
     * @param key the extension key the requesting frame was created for
     * @param msg the request, as received
     * @param reply delivers a reply to the requesting frame
     * @returns a promise that resolves once the reply is sent
     */
    handleMessageAsync(key: string, msg: unknown, reply: (msg: ProjfsReply) => void): Promise<void> {
        const request = msg as ProjfsRequest;
        const id = typeof request?.id === "string" ? request.id : undefined;
        const errorReply = (code: ProjfsErrorCode, message: string): ProjfsReply =>
            ({ type: PROJFS_MESSAGE_TYPE, id, subtype: "error", code, message });

        const mutates = request?.subtype === "write" || request?.subtype === "delete";
        if (mutates) {
            const pending = this.pendingMutations[key] || 0;
            if (pending >= PROJFS_MAX_PENDING_MUTATIONS) {
                reply(errorReply("RATE_LIMITED", `${pending} writes and deletes are already waiting for replies.`));
                return Promise.resolve();
            }
            this.pendingMutations[key] = pending + 1;
        }

        const project = this.getProject();
        const answered = (this.tails[key] || Promise.resolve())
            .then(() => mutates ? this.admitMutationAsync(key, project) : undefined)
            .then(() => this.exclusiveAsync(() => this.applyAsync(key, request, project)))
            .then(
                (result): ProjfsReply => ({ ...result, type: PROJFS_MESSAGE_TYPE, id }),
                e => e instanceof ProjfsRequestError
                    ? errorReply(e.code, e.message)
                    : errorReply("FAILED", e?.message || String(e)))
            .then(answer => {
                if (mutates) this.pendingMutations[key]--;
                reply(answer);
            })
            .catch(e => pxt.reportException(e));
        this.tails[key] = answered;
        return answered;
    }

    /**
     * Resolves once a write or delete of the extension `key` may apply under
     * the rate limit, counting it as applying from then on.
     * @param project the project the request arrived in
     */
    protected async admitMutationAsync(key: string, project: ProjfsProject | undefined): Promise<void> {
        for (;;) {
            this.openProjectOrThrow(project);
            const now = this.now();
            const recent = (this.recentMutations[key] || []).filter(t => now - t < PROJFS_RATE_WINDOW_MS);
            this.recentMutations[key] = recent;
            if (recent.length < PROJFS_RATE_LIMIT) {
                recent.push(now);
                return;
            }
            await this.delay(recent[0] + PROJFS_RATE_WINDOW_MS - now);
        }
    }

    /** Runs `apply` once no other request is applying. */
    protected exclusiveAsync<T>(apply: () => Promise<T>): Promise<T> {
        const result = this.applying.then(apply);
        this.applying = result.then(() => { }, () => { });
        return result;
    }

    /**
     * Returns `project` if it is still the open project.
     * @throws a `PROJECT_CLOSED` refusal if `project` is undefined or has closed
     */
    protected openProjectOrThrow(project: ProjfsProject | undefined): ProjfsProject {
        if (!project)
            throw new ProjfsRequestError("PROJECT_CLOSED", "No project was open when the request arrived.");
        if (this.getProject() !== project)
            throw new ProjfsRequestError("PROJECT_CLOSED", "The project open when the request arrived has closed.");
        return project;
    }

    /**
     * Applies `request` to the project it arrived in.
     * @param arrivedIn the project open when the request arrived
     */
    protected async applyAsync(scope: string, request: ProjfsRequest, arrivedIn: ProjfsProject | undefined): Promise<ProjfsReplyBody> {
        const project = this.openProjectOrThrow(arrivedIn);
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
