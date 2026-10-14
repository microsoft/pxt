import {
    PROJFS_MESSAGE_TYPE,
    ProjfsDeleteRequest,
    ProjfsErrorCode,
    ProjfsFileInfo,
    ProjfsReply,
    ProjfsRequest,
    ProjfsWriteRequest,
} from "../../pxtservices/projfs";

/**
 * The most bytes the files under one simulator extension folder may hold: the
 * UTF-8 bytes of each file's content plus those of its name relative to the
 * folder.
 */
export const PROJFS_FOLDER_QUOTA_BYTES = 512 * 1024;

/** The most files one simulator extension folder may store. */
export const PROJFS_MAX_FOLDER_FILES = 256;

/** The most characters of a name a write gives a file, relative to its folder. */
export const PROJFS_MAX_NAME_LENGTH = 128;

/** The most `/`-separated segments of a name a write gives a file, relative to its folder. */
export const PROJFS_MAX_NAME_SEGMENTS = 8;

/**
 * The most writes and deletes on one simulator extension folder that apply
 * within {@link PROJFS_RATE_WINDOW_MS}; later ones wait for the window to
 * allow them.
 */
export const PROJFS_RATE_LIMIT = 30;

/** The sliding window, in milliseconds, over which {@link PROJFS_RATE_LIMIT} applies. */
export const PROJFS_RATE_WINDOW_MS = 10000;

/**
 * The most requests on one simulator extension folder that may wait for
 * replies at once; more are refused with `RATE_LIMITED`.
 */
export const PROJFS_MAX_PENDING_REQUESTS = 1000;

/**
 * The open project, as the projfs host reads and changes it. The host tells
 * projects apart by identity: one object stands for the project from the time
 * it opens until it closes, and reopening a project yields a new object.
 */
export interface ProjfsProject {
    /**
     * Returns a promise that resolves once the project has loaded, and
     * rejects if its load fails. It settles even if the project is replaced
     * while loading. Until then the project holds none of its files.
     */
    loadedAsync(): Promise<void>;
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

/**
 * Creates or replaces the stored file `name` of `epkg` and saves it. If the
 * text editor shows the file, it reloads to show `content`, which replaces any
 * change not yet saved from it and resets its undo history and cursor; the
 * promise then settles once the editor shows `content`. Only a write to the
 * shown file forces that reload: forcing any other write would discard the
 * shown file's unsaved changes.
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

/**
 * The open project as the simulator extension hosts read it: the project the
 * editor has loaded, until it closes. A closed project reads as no project
 * until the editor loads another, which is always a new object.
 */
export class OpenProjectTracker<T> {
    // the project closed last
    protected closed: T | undefined;

    /** @param getLoaded returns the project the editor has loaded, or undefined if none is */
    constructor(protected readonly getLoaded: () => T | undefined) {
    }

    /** Returns the open project, or undefined if none is open. */
    get(): T | undefined {
        const project = this.getLoaded();
        return project !== undefined && project !== this.closed ? project : undefined;
    }

    /** Closes the open project: {@link get} returns undefined until the editor loads another. */
    close() {
        this.closed = this.getLoaded();
    }
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
 * Returns the project folder of the simulator extension registered under
 * `key`: the root of its GitHub repository, `owner/repo`, whatever subfolder
 * `key` names, so every registration of one repository shares the folder.
 * Returns undefined if `key` names no repository, or the folder would fall
 * under `pxt_modules/`.
 * @param key the simulator extension's key, e.g. `owner/repo` or `owner/repo/sub`
 */
export function getProjfsFolder(key: string): string | undefined {
    const folder = pxt.github.parseRepoId(key)?.slug;
    return isValidRelativeName(folder) && !folder.startsWith("pxt_modules/") ? folder : undefined;
}

/**
 * Returns the project name of the file `name` in `folder`, or undefined if
 * `name` is not a valid relative name, ends in the reserved
 * `pxt.SIMX_EDITOR_MARKER_SUFFIX`, or the result would fall under
 * `pxt_modules/` or name a session-only file (see `pxt.isSessionOnlyFile`).
 * @param folder the simulator extension's folder, e.g. `owner/repo`
 */
export function getFolderFileName(folder: string, name: unknown): string | undefined {
    if (!isValidRelativeName(name) || name.endsWith(pxt.SIMX_EDITOR_MARKER_SUFFIX)) return undefined;
    const inFolder = `${folder}/${name}`;
    if (!isValidRelativeName(inFolder) || inFolder.startsWith("pxt_modules/") || pxt.isSessionOnlyFile(inFolder)) return undefined;
    return inFolder;
}

/**
 * Returns true if a write may give a file the name `name`, relative to its
 * folder: the file explorer accepts it for a new file (see
 * `pxt.isValidProjectFileName`), and it has at most
 * {@link PROJFS_MAX_NAME_LENGTH} characters in at most
 * {@link PROJFS_MAX_NAME_SEGMENTS} segments.
 */
export function isWritableName(name: string): boolean {
    return pxt.isValidProjectFileName(name)
        && name.length <= PROJFS_MAX_NAME_LENGTH
        && name.split("/").length <= PROJFS_MAX_NAME_SEGMENTS;
}

/**
 * Returns the names in a list of the project's pxt.json.
 * @param list the list to read: `files` (the default) or `testFiles`
 */
export function getListedFiles(files: pxt.Map<string>, list: "files" | "testFiles" = "files"): string[] {
    const config = pxt.Util.jsonTryParse(files[pxt.CONFIG_NAME]) as pxt.PackageConfig;
    return Array.isArray(config?.[list])
        ? config[list].filter(name => typeof name === "string")
        : [];
}

/**
 * Returns the files in `folder` that are both stored and listed in the
 * "files" list of pxt.json, in listed order, with their sizes. Names are
 * relative to `folder`, and each is a valid relative name.
 * @param folder the simulator extension's folder, e.g. `owner/repo`
 */
export function getVisibleFiles(files: pxt.Map<string>, folder: string): ProjfsFileInfo[] {
    const prefix = folder + "/";
    return getListedFiles(files)
        .filter(name => name.startsWith(prefix) && Object.prototype.hasOwnProperty.call(files, name))
        .map(name => name.slice(prefix.length))
        .filter(isValidRelativeName)
        .map(name => ({ name, size: utf8Length(files[prefix + name]) }));
}

/** What the stored files under a simulator extension folder take up, listed or not. */
export interface ProjfsFolderUsage {
    /** The UTF-8 bytes of each file's content and of its name relative to the folder, summed. */
    bytes: number;
    /** How many files the folder stores. */
    files: number;
}

/** Returns what the stored files under `folder` take up, listed or not. */
export function getFolderUsage(files: pxt.Map<string>, folder: string): ProjfsFolderUsage {
    const prefix = folder + "/";
    const names = Object.keys(files).filter(name => name.startsWith(prefix));
    return {
        bytes: names.reduce((total, name) => total + utf8Length(name.slice(prefix.length)) + utf8Length(files[name]), 0),
        files: names.length,
    };
}

/** Returns a monotonic time in milliseconds: `performance.now()` where available, else `Date.now()`. */
function monotonicNow(): number {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
}

class ProjfsRequestError extends Error {
    constructor(public readonly code: ProjfsErrorCode, message: string) {
        super(message);
    }
}

/**
 * Serves the project-file requests of simulator extensions. Each extension
 * lists, reads, writes and deletes files in its folder (see
 * {@link getProjfsFolder}), by names relative to that folder; within the
 * folder it lists and reads only the files pxt.json lists. Every
 * registration of one repository, and both frames of each, share the
 * folder, its quota, its rate limit and its queue.
 *
 * Every request gets one reply, and the replies for one folder are sent in
 * the order its requests arrive. One request applies at a time, and each
 * folder's requests apply in the order they arrive. A folder's writes and
 * deletes beyond {@link PROJFS_RATE_LIMIT} within {@link PROJFS_RATE_WINDOW_MS}
 * wait, with the requests behind them, until the window allows them. A
 * request applies only to the project open when it arrived, once that
 * project has loaded; if that project fails to load, or has closed by the
 * time the request's turn comes, it is refused with `PROJECT_CLOSED`, and a
 * request that has begun applying completes in the project it began in.
 *
 * A request is refused on arrival, without waiting its turn, with
 * `RATE_LIMITED` when {@link PROJFS_MAX_PENDING_REQUESTS} requests on its
 * folder already wait for replies, and with `QUOTA_EXCEEDED` when it writes
 * more content than {@link PROJFS_FOLDER_QUOTA_BYTES}; its reply still
 * follows the replies to the requests before it.
 *
 * Writes and deletes are artifacts unless flagged `dirty`, in which case they
 * also pass through {@link ProjfsProject.markDirty} once applied.
 */
export class ProjfsHost {
    // per folder: settles once every request received for the folder has been answered
    protected tails: pxt.Map<Promise<void>> = {};
    // settles once the request applying now, whichever extension sent it, has finished
    protected applying: Promise<void> = Promise.resolve();
    // per folder: when each write and delete within the rate window began to apply
    protected recentMutations: pxt.Map<number[]> = {};
    // per folder: how many requests have been received and not yet answered
    protected pendingRequests: pxt.Map<number> = {};

    /**
     * @param getProject returns the open project, or undefined if none is open
     * @param now returns the current time in milliseconds on a clock that never
     * goes back; defaults to `performance.now()` where available, else `Date.now()`
     * @param delay returns a promise that resolves after the given number of milliseconds
     */
    constructor(
        protected readonly getProject: () => ProjfsProject | undefined,
        protected readonly now: () => number = monotonicNow,
        protected readonly delay: (ms: number) => Promise<void> = ms => pxt.Util.delay(ms)
    ) {
    }

    /**
     * Queues a request from the simulator extension with the given key behind
     * those already received for its folder, binds it to the project open
     * now, waits for that project to load, and sends it one reply once it has
     * applied or been refused.
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

        const folder = getProjfsFolder(key);
        if (folder === undefined) {
            reply(errorReply("UNREGISTERED", `${key} names no GitHub repository, so it has no project folder.`));
            return Promise.resolve();
        }

        const tail = this.tails[folder] || Promise.resolve();
        const refusal = this.arrivalRefusal(folder, request);
        if (refusal) {
            const answer = errorReply(refusal.code, refusal.message);
            const refused = tail
                .then(() => reply(answer))
                .catch(e => pxt.reportException(e));
            this.tails[folder] = refused;
            return refused;
        }
        this.pendingRequests[folder] = (this.pendingRequests[folder] || 0) + 1;

        const mutates = request?.subtype === "write" || request?.subtype === "delete";
        const project = this.getProject();
        const answered = tail
            .then(() => this.projectLoadedAsync(project))
            .then(() => mutates ? this.admitMutationAsync(folder, project) : undefined)
            .then(() => this.exclusiveAsync(() => this.applyAsync(folder, request, project)))
            .then(
                (result): ProjfsReply => ({ ...result, type: PROJFS_MESSAGE_TYPE, id }),
                e => e instanceof ProjfsRequestError
                    ? errorReply(e.code, e.message)
                    : errorReply("FAILED", e?.message || String(e)))
            .then(answer => {
                this.pendingRequests[folder]--;
                reply(answer);
            })
            .catch(e => pxt.reportException(e));
        this.tails[folder] = answered;
        return answered;
    }

    /**
     * Returns the refusal a request on `folder` gets on arrival: `RATE_LIMITED`
     * if {@link PROJFS_MAX_PENDING_REQUESTS} requests on the folder wait for
     * replies, `QUOTA_EXCEEDED` if it writes more content than the folder may
     * hold; undefined if it may wait its turn.
     */
    protected arrivalRefusal(folder: string, request: ProjfsRequest): ProjfsRequestError | undefined {
        const pending = this.pendingRequests[folder] || 0;
        if (pending >= PROJFS_MAX_PENDING_REQUESTS)
            return new ProjfsRequestError("RATE_LIMITED", `${pending} requests on ${folder}/ are already waiting for replies.`);
        const content: unknown = request?.subtype === "write" ? request.content : undefined;
        // a string has at least as many UTF-8 bytes as UTF-16 code units
        if (typeof content === "string" && (content.length > PROJFS_FOLDER_QUOTA_BYTES || utf8Length(content) > PROJFS_FOLDER_QUOTA_BYTES))
            return new ProjfsRequestError("QUOTA_EXCEEDED", `The content is larger than the ${PROJFS_FOLDER_QUOTA_BYTES} bytes ${folder}/ may hold.`);
        return undefined;
    }

    /**
     * Resolves once `project` has loaded, or at once if there is none.
     * @param project the project the request arrived in
     * @throws a `PROJECT_CLOSED` refusal if `project` fails to load
     */
    protected async projectLoadedAsync(project: ProjfsProject | undefined): Promise<void> {
        if (!project) return;
        try {
            await project.loadedAsync();
        } catch (e) {
            throw new ProjfsRequestError("PROJECT_CLOSED", "The project open when the request arrived failed to load.");
        }
    }

    /**
     * Resolves once a write or delete on `folder` may apply under the rate
     * limit, counting it as applying from then on.
     * @param project the project the request arrived in
     */
    protected async admitMutationAsync(folder: string, project: ProjfsProject | undefined): Promise<void> {
        for (;;) {
            this.openProjectOrThrow(project);
            const now = this.now();
            const recent = (this.recentMutations[folder] || []).filter(t => now - t < PROJFS_RATE_WINDOW_MS);
            this.recentMutations[folder] = recent;
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
    protected async applyAsync(folder: string, request: ProjfsRequest, arrivedIn: ProjfsProject | undefined): Promise<ProjfsReplyBody> {
        const project = this.openProjectOrThrow(arrivedIn);
        const files = project.getFiles();

        switch (request?.subtype) {
            case "list":
                return { subtype: "files", files: getVisibleFiles(files, folder) };

            case "read": {
                const { name } = request;
                const inFolder = this.folderFileNameOrThrow(folder, name);
                if (!getVisibleFiles(files, folder).some(f => f.name === name))
                    throw new ProjfsRequestError("NOT_FOUND", `${name} is not a file in ${folder}/.`);
                return { subtype: "content", name, content: files[inFolder] };
            }

            case "write": {
                const { content } = request;
                if (typeof content !== "string")
                    throw new ProjfsRequestError("INVALID_REQUEST", "The content must be a string.");
                const dirty = this.dirtyOrThrow(request);
                const name = this.folderFileNameOrThrow(folder, request.name);
                if (!isWritableName(request.name))
                    throw new ProjfsRequestError("INVALID_NAME",
                        `${request.name} is not a name a write may give a file: it must start with a letter, digit or underscore, `
                        + `use only letters, digits, "_", "-", "." and "/", and have at most ${PROJFS_MAX_NAME_LENGTH} characters `
                        + `in at most ${PROJFS_MAX_NAME_SEGMENTS} segments.`);
                const stored = Object.prototype.hasOwnProperty.call(files, name);
                const usage = getFolderUsage(files, folder);
                if (!stored && usage.files >= PROJFS_MAX_FOLDER_FILES)
                    throw new ProjfsRequestError("QUOTA_EXCEEDED", `${folder}/ already stores ${usage.files} files, the most it may store.`);
                const nameBytes = utf8Length(request.name);
                const replaced = stored ? nameBytes + utf8Length(files[name]) : 0;
                const total = usage.bytes - replaced + nameBytes + utf8Length(content);
                if (total > PROJFS_FOLDER_QUOTA_BYTES && total > usage.bytes)
                    throw new ProjfsRequestError("QUOTA_EXCEEDED",
                        `Writing ${name} would bring ${folder}/ to ${total} bytes; it holds ${usage.bytes} of ${PROJFS_FOLDER_QUOTA_BYTES}.`);
                await project.writeFileAsync(name, content);
                if (getListedFiles(files).indexOf(name) < 0)
                    await project.setListedAsync(name, true);
                if (dirty) project.markDirty?.(name, content);
                return { subtype: "ack", name: request.name };
            }

            case "delete": {
                const dirty = this.dirtyOrThrow(request);
                const name = this.folderFileNameOrThrow(folder, request.name);
                const stored = Object.prototype.hasOwnProperty.call(files, name);
                const listed = getListedFiles(files).indexOf(name) >= 0 || getListedFiles(files, "testFiles").indexOf(name) >= 0;
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

    protected folderFileNameOrThrow(folder: string, name: unknown): string {
        const inFolder = getFolderFileName(folder, name);
        if (!inFolder)
            throw new ProjfsRequestError("INVALID_NAME", `${name} is not a valid relative file name, or is reserved.`);
        return inFolder;
    }
}

/** A reply without the `type` and `id` fields every reply carries. */
type ProjfsReplyBody<R = ProjfsReply> = R extends ProjfsReply ? Omit<R, "type" | "id"> : never;
