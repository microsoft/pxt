import {
    PROJFS_MESSAGE_TYPE,
    ProjfsDeleteRequest,
    ProjfsErrorCode,
    ProjfsFileInfo,
    ProjfsNotification,
    ProjfsReply,
    ProjfsRequest,
    ProjfsWriteRequest,
} from "../../pxtservices/projfs";
import { SlidingWindowAdmission } from "./slidingWindowAdmission";
import {
    caughtErrorReply,
    errorReply,
    getSimxRepository,
    loadedOpenProjectAsync,
    NotificationBurst,
    openProjectOrThrow,
    requestId,
    SimxReplyBody,
    SimxRequestError,
} from "./simxRequests";

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
 * The time, in milliseconds, after the last change of a burst to a folder at
 * which the folder's subscribed frames are notified of it, unless
 * {@link PROJFS_NOTIFY_MAX_DELAY_MS} comes first.
 */
export const PROJFS_NOTIFY_DEBOUNCE_MS = 250;

/**
 * The longest time, in milliseconds, after the first change of a burst to a
 * folder at which the folder's subscribed frames are notified of it, however
 * long its changes go on.
 */
export const PROJFS_NOTIFY_MAX_DELAY_MS = 2000;

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
    /**
     * Deletes a stored file and removes it from the "files" and "testFiles"
     * lists of pxt.json. Leaves pxt.json unchanged if it is missing or malformed.
     */
    deleteFileAsync(name: string): Promise<void>;
    /**
     * Adds `name` to the "files" list of pxt.json, or removes it from the
     * "files" and "testFiles" lists. Changes nothing if pxt.json is missing
     * or malformed.
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
    /**
     * Adds a listener called on each change to the project's stored files:
     * with the name of a file stored, removed or given new content, pxt.json
     * included, and with undefined when every file is replaced at once. The
     * listener is called synchronously, once the change shows in
     * {@link getFiles}. A listener that throws is reported with
     * `pxt.reportException`, and the change and the other listeners proceed.
     */
    addChangeListener(listener: (name: string | undefined) => void): void;
    /** Removes a listener added with addChangeListener. */
    removeChangeListener(listener: (name: string | undefined) => void): void;
}

/** A frame that subscribes to change notifications, as the projfs host checks it. */
export interface ProjfsFrame {
    /** False once the frame has been removed from the document. */
    readonly isConnected: boolean;
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
 * `key`: the root of its GitHub repository, `owner/repo` in lower case,
 * whatever subfolder `key` names, so every registration of one repository
 * shares the folder. Returns undefined if `key` names no repository, or the
 * folder would fall under `pxt_modules/`.
 * @param key the simulator extension's key, e.g. `owner/repo` or `owner/repo/sub`
 */
export function getProjfsFolder(key: string): string | undefined {
    const folder = getSimxRepository(key);
    return isValidRelativeName(folder) && !folder.startsWith("pxt_modules/") ? folder : undefined;
}

/**
 * Returns true if the open project's own code declares `symbol` in a file in
 * `folder`: the symbol comes from no package, and its file name, the file's
 * project name, lies under `folder`.
 * @param symbol the symbol, as the API info gives it
 * @param folder a simulator extension's folder, e.g. `owner/repo`, as {@link getProjfsFolder} returns it
 */
export function isDeclaredInProjectFolder(symbol: Pick<pxtc.SymbolInfo, "pkg" | "fileName">, folder: string): boolean {
    return !symbol.pkg && symbol.fileName.startsWith(folder + "/");
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
 * `pxt.isValidProjectFileName`), it has at most
 * {@link PROJFS_MAX_NAME_LENGTH} characters in at most
 * {@link PROJFS_MAX_NAME_SEGMENTS} segments, and its last segment is not
 * `pxt.json` and does not end in `.jres`, in any letter case.
 */
function isWritableName(name: string): boolean {
    const segments = name.split("/");
    const last = segments[segments.length - 1].toLowerCase();
    return pxt.isValidProjectFileName(name)
        && name.length <= PROJFS_MAX_NAME_LENGTH
        && segments.length <= PROJFS_MAX_NAME_SEGMENTS
        && last !== pxt.CONFIG_NAME
        && !last.endsWith(".jres");
}

/**
 * Returns the names in a list of the project's pxt.json.
 * @param list the list to read: `files` (the default) or `testFiles`
 */
function getListedFiles(files: pxt.Map<string>, list: "files" | "testFiles" = "files"): string[] {
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
        .map(name => ({ name, size: pxt.Util.toUTF8Array(files[prefix + name]).length }));
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
        bytes: names.reduce((total, name) => total + pxt.Util.toUTF8Array(name.slice(prefix.length)).length + pxt.Util.toUTF8Array(files[name]).length, 0),
        files: names.length,
    };
}

/** A stored file under a simulator extension folder, as the projfs host compares it between notifications. */
interface ProjfsFolderFile {
    /** True if the "files" list of pxt.json lists the file. */
    listed: boolean;
    /** The file's content. */
    content: string;
}

/**
 * Returns the stored files under `folder` whose names requests can address
 * (see {@link getFolderFileName}), listed or not, keyed by their names
 * relative to the folder.
 * @param folder the simulator extension's folder, e.g. `owner/repo`
 */
function getFolderFiles(files: pxt.Map<string>, folder: string): pxt.Map<ProjfsFolderFile> {
    const prefix = folder + "/";
    const listed = getListedFiles(files);
    const inFolder: pxt.Map<ProjfsFolderFile> = {};
    for (const name of Object.keys(files)) {
        if (!name.startsWith(prefix) || getFolderFileName(folder, name.slice(prefix.length)) !== name) continue;
        inFolder[name.slice(prefix.length)] = { listed: listed.indexOf(name) >= 0, content: files[name] };
    }
    return inFolder;
}

/**
 * Returns the names, relative to their folder, of the files that differ
 * between `before` and `after`: those in only one of them, and those whose
 * listing or content differs. Names follow `before`'s order, then `after`'s.
 */
function getChangedFolderFiles(before: pxt.Map<ProjfsFolderFile>, after: pxt.Map<ProjfsFolderFile>): string[] {
    const changed = Object.keys(before).filter(name => {
        const now = after[name];
        return !now || now.listed !== before[name].listed || now.content !== before[name].content;
    });
    return changed.concat(Object.keys(after).filter(name => !Object.prototype.hasOwnProperty.call(before, name)));
}

/** The changes to one folder that its subscribers are to be notified of. */
interface ProjfsBurst {
    /** The names, relative to the folder, the project's change listener reported, each once, in first-change order. */
    names: string[];
    /** True if pxt.json changed or every file was replaced, so the folder's files are compared with their last notified state. */
    compare: boolean;
}

/** A folder the projfs host compares between notifications to it. */
interface ProjfsWatchedFolder {
    /** The folder's stored files as last notified, or as they were when the folder was first subscribed to. */
    files: pxt.Map<ProjfsFolderFile>;
    /** Merges the folder's changes into notifications. */
    burst: NotificationBurst<ProjfsBurst>;
}

// the queue key of the lane every request applies in, one at a time; never a
// folder, since every folder holds a "/"
const APPLY_LANE = "apply";

/**
 * Serves the project-file requests of simulator extensions. Each extension
 * lists, reads, writes and deletes files in its folder (see
 * {@link getProjfsFolder}), by names relative to that folder; within the
 * folder it lists and reads only the files pxt.json lists. Every
 * registration of one repository, and both frames of each, share the
 * folder, its quota, its rate limit and its queue.
 *
 * Every request gets one reply, and the replies for one folder are sent in
 * the order its requests arrive, a subscribe request's excepted. One request
 * applies at a time, and each folder's requests apply in the order they
 * arrive. A folder's writes and deletes beyond {@link PROJFS_RATE_LIMIT}
 * within {@link PROJFS_RATE_WINDOW_MS} wait, with the requests behind them,
 * until the window allows them. A request applies only to the project open
 * when it arrived, once that project has loaded; if that project fails to
 * load, or has closed by the time the request's turn comes, it is refused
 * with `PROJECT_CLOSED`, and a request that has begun applying completes in
 * the project it began in.
 *
 * A request is refused on arrival, without waiting its turn, with
 * `RATE_LIMITED` when {@link PROJFS_MAX_PENDING_REQUESTS} requests on its
 * folder already wait for replies, and with `QUOTA_EXCEEDED` when it writes
 * more content than {@link PROJFS_FOLDER_QUOTA_BYTES}; its reply still
 * follows the replies to the requests before it.
 *
 * Writes and deletes are artifacts unless flagged `dirty`, in which case they
 * also pass through {@link ProjfsProject.markDirty} once applied.
 *
 * A subscribe request subscribes the requesting frame to its folder's
 * changes. It is neither queued nor limited: it is answered once the project
 * open when it arrived has loaded. A frame holds at most one subscription,
 * which ends when the project it was made in closes, or when the frame is
 * removed. The host listens to one project at a time, the one its
 * subscriptions were made in, and lets go of it when it closes. A folder's
 * subscribers are told the names, relative to the folder, of the files whose
 * content, existence or listing in pxt.json changed: the names the project's
 * change listener reports under the folder, then, after a pxt.json change or
 * a replacement of every file, the names whose stored state differs from the
 * one last notified. Changes are merged per folder: subscribers get one
 * notification for all the changes made before it is sent, sent
 * {@link PROJFS_NOTIFY_DEBOUNCE_MS} after the last of them, or
 * {@link PROJFS_NOTIFY_MAX_DELAY_MS} after the first if that is sooner, and
 * none when the changes leave no name to report. A notification pending when
 * the project closes is not sent.
 */
export class ProjfsHost {
    // per folder: the requests received for the folder, each until it has been
    // answered; and, under APPLY_LANE, the requests of every folder, each while it applies
    protected readonly queue = new pxt.Util.PromiseQueue();
    // per folder: admits each write and delete under the rate limit
    protected readonly mutations: SlidingWindowAdmission;
    // per folder: how many requests have been received and not yet answered
    protected pendingRequests: pxt.Map<number> = {};
    // the subscribed frames, each once, with its folder and the function that delivers its notifications
    protected subscribers: { frame: ProjfsFrame, folder: string, reply: (msg: ProjfsNotification) => void }[] = [];
    // the project every subscription was made in, which the host listens to, with,
    // per folder subscribed to, its stored files as last notified and the burst
    // merging its changes; undefined while there is none
    protected watched: {
        project: ProjfsProject,
        folders: pxt.Map<ProjfsWatchedFolder>,
    } | undefined;

    /**
     * @param getProject returns the open project, or undefined if none is open
     * @param now returns the current time in milliseconds on a clock that never
     * goes back; defaults to `pxt.Util.monotonicNow`
     * @param delay returns a promise that resolves after the given number of milliseconds
     */
    constructor(
        protected readonly getProject: () => ProjfsProject | undefined,
        protected readonly now: () => number = pxt.Util.monotonicNow,
        protected readonly delay: (ms: number) => Promise<void> = ms => pxt.Util.delay(ms)
    ) {
        this.mutations = new SlidingWindowAdmission(PROJFS_RATE_LIMIT, PROJFS_RATE_WINDOW_MS, now, delay);
    }

    /**
     * Queues a request from the simulator extension with the given key behind
     * those already received for its folder, binds it to the project open
     * now, waits for that project to load, and sends it one reply once it has
     * applied or been refused. A subscribe request is not queued; it also
     * subscribes `frame`, whose notifications `reply` delivers, to the
     * folder's changes until the project closes or the frame is removed, and
     * subscribing again from the same frame changes nothing.
     * @param key the extension key the requesting frame was created for
     * @param msg the request, as received
     * @param reply delivers a reply or notification to the requesting frame
     * @param frame the requesting frame
     * @returns a promise that resolves once the reply is sent
     */
    handleMessageAsync(key: string, msg: unknown, reply: (msg: ProjfsReply | ProjfsNotification) => void, frame: ProjfsFrame): Promise<void> {
        const request = msg as ProjfsRequest;
        const id = requestId(msg);

        const folder = getProjfsFolder(key);
        if (folder === undefined) {
            reply(errorReply(PROJFS_MESSAGE_TYPE, id, "UNREGISTERED", `${key} names no GitHub repository, so it has no project folder.`));
            return Promise.resolve();
        }

        if (request?.subtype === "subscribe")
            return this.subscribeAsync(folder, id, reply, frame);

        const refusal = this.arrivalRefusal(folder, request);
        if (refusal) {
            const answer = errorReply(PROJFS_MESSAGE_TYPE, id, refusal.code, refusal.message);
            return this.queue.enqueue(folder, async () => reply(answer))
                .catch(e => pxt.reportException(e));
        }
        this.pendingRequests[folder] = (this.pendingRequests[folder] || 0) + 1;

        const mutates = request?.subtype === "write" || request?.subtype === "delete";
        const project = this.getProject();
        return this.queue.enqueue(folder, async () => {
            let answer: ProjfsReply;
            try {
                const loaded = await loadedOpenProjectAsync(project, () => this.getProject());
                if (mutates) await this.mutations.admitAsync(folder, () => openProjectOrThrow(loaded, () => this.getProject()));
                const result = await this.queue.enqueue(APPLY_LANE, () => this.applyAsync(folder, request, loaded));
                answer = { ...result, type: PROJFS_MESSAGE_TYPE, id } as ProjfsReply;
            } catch (e) {
                answer = caughtErrorReply<typeof PROJFS_MESSAGE_TYPE, ProjfsErrorCode>(PROJFS_MESSAGE_TYPE, id, e);
            }
            this.pendingRequests[folder]--;
            reply(answer);
        }).catch(e => pxt.reportException(e));
    }

    /**
     * Returns the refusal a request on `folder` gets on arrival: `RATE_LIMITED`
     * if {@link PROJFS_MAX_PENDING_REQUESTS} requests on the folder wait for
     * replies, `QUOTA_EXCEEDED` if it writes more content than the folder may
     * hold; undefined if it may wait its turn.
     */
    protected arrivalRefusal(folder: string, request: ProjfsRequest): SimxRequestError<ProjfsErrorCode> | undefined {
        const pending = this.pendingRequests[folder] || 0;
        if (pending >= PROJFS_MAX_PENDING_REQUESTS)
            return new SimxRequestError("RATE_LIMITED", `${pending} requests on ${folder}/ are already waiting for replies.`);
        const content: unknown = request?.subtype === "write" ? request.content : undefined;
        // a string has at least as many UTF-8 bytes as UTF-16 code units
        if (typeof content === "string" && (content.length > PROJFS_FOLDER_QUOTA_BYTES || pxt.Util.toUTF8Array(content).length > PROJFS_FOLDER_QUOTA_BYTES))
            return new SimxRequestError("QUOTA_EXCEEDED", `The content is larger than the ${PROJFS_FOLDER_QUOTA_BYTES} bytes ${folder}/ may hold.`);
        return undefined;
    }

    /**
     * Applies `request` to the project it arrived in.
     * @param arrivedIn the project open when the request arrived
     */
    protected async applyAsync(folder: string, request: ProjfsRequest, arrivedIn: ProjfsProject): Promise<SimxReplyBody<ProjfsReply>> {
        const project = openProjectOrThrow(arrivedIn, () => this.getProject());
        const files = project.getFiles();

        switch (request?.subtype) {
            case "list":
                return { subtype: "files", files: getVisibleFiles(files, folder) };

            case "read": {
                const { name } = request;
                const inFolder = this.folderFileNameOrThrow(folder, name);
                if (!getVisibleFiles(files, folder).some(f => f.name === name))
                    throw new SimxRequestError<ProjfsErrorCode>("NOT_FOUND", `${name} is not a file in ${folder}/.`);
                return { subtype: "content", name, content: files[inFolder] };
            }

            case "write": {
                const { content } = request;
                if (typeof content !== "string")
                    throw new SimxRequestError<ProjfsErrorCode>("INVALID_REQUEST", "The content must be a string.");
                const dirty = this.dirtyOrThrow(request);
                const name = this.folderFileNameOrThrow(folder, request.name);
                if (!isWritableName(request.name))
                    throw new SimxRequestError<ProjfsErrorCode>("INVALID_NAME",
                        `${request.name} is not a name a write may give a file: it must start with a letter, digit or underscore, `
                        + `use only letters, digits, "_", "-", "." and "/", have at most ${PROJFS_MAX_NAME_LENGTH} characters `
                        + `in at most ${PROJFS_MAX_NAME_SEGMENTS} segments, and not end in ${pxt.CONFIG_NAME} or .jres.`);
                const stored = Object.prototype.hasOwnProperty.call(files, name);
                const usage = getFolderUsage(files, folder);
                if (!stored && usage.files >= PROJFS_MAX_FOLDER_FILES)
                    throw new SimxRequestError<ProjfsErrorCode>("QUOTA_EXCEEDED", `${folder}/ already stores ${usage.files} files, the most it may store.`);
                const nameBytes = pxt.Util.toUTF8Array(request.name).length;
                const replaced = stored ? nameBytes + pxt.Util.toUTF8Array(files[name]).length : 0;
                const total = usage.bytes - replaced + nameBytes + pxt.Util.toUTF8Array(content).length;
                if (total > PROJFS_FOLDER_QUOTA_BYTES && total > usage.bytes)
                    throw new SimxRequestError<ProjfsErrorCode>("QUOTA_EXCEEDED",
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
                    throw new SimxRequestError<ProjfsErrorCode>("NOT_FOUND", `${name} does not exist.`);
                if (stored)
                    await project.deleteFileAsync(name);
                else
                    await project.setListedAsync(name, false);
                if (dirty) project.markDirty?.(name, undefined);
                return { subtype: "ack", name: request.name };
            }

            default:
                throw new SimxRequestError<ProjfsErrorCode>("INVALID_REQUEST", `Unknown request ${(request as any)?.subtype}.`);
        }
    }

    protected dirtyOrThrow(request: ProjfsWriteRequest | ProjfsDeleteRequest): boolean {
        const dirty: unknown = request.dirty;
        if (dirty !== undefined && typeof dirty !== "boolean")
            throw new SimxRequestError<ProjfsErrorCode>("INVALID_REQUEST", "The dirty flag must be true or false.");
        return dirty === true;
    }

    protected folderFileNameOrThrow(folder: string, name: unknown): string {
        const inFolder = getFolderFileName(folder, name);
        if (!inFolder)
            throw new SimxRequestError<ProjfsErrorCode>("INVALID_NAME", `${name} is not a valid relative file name, or is reserved.`);
        return inFolder;
    }

    /**
     * Waits for the project open now to load, subscribes `frame` to the
     * changes of `folder` in it, and sends the request one reply.
     * @param id the request's id, as {@link requestId} reads it
     */
    protected async subscribeAsync(folder: string, id: string | undefined, reply: (msg: ProjfsReply | ProjfsNotification) => void, frame: ProjfsFrame): Promise<void> {
        let answer: ProjfsReply;
        try {
            this.watch(await loadedOpenProjectAsync(this.getProject(), () => this.getProject()));
            this.watchFolder(folder);
            this.subscribers = this.subscribers.filter(s => s.frame.isConnected);
            if (!this.subscribers.some(s => s.frame === frame)) this.subscribers.push({ frame, folder, reply });
            answer = { type: PROJFS_MESSAGE_TYPE, id, subtype: "ack" };
        } catch (e) {
            answer = caughtErrorReply<typeof PROJFS_MESSAGE_TYPE, ProjfsErrorCode>(PROJFS_MESSAGE_TYPE, id, e);
        }
        reply(answer);
    }

    /** Listens to `project` for changes, ending the subscriptions made in any other project. */
    protected watch(project: ProjfsProject) {
        if (this.watched?.project === project) return;
        this.unwatch();
        project.addChangeListener(this.onFileChange);
        this.watched = { project, folders: {} };
    }

    /** Starts comparing the files of `folder` in the watched project with their state as of now, unless it already does. */
    protected watchFolder(folder: string) {
        const watched = this.watched;
        if (!watched || Object.prototype.hasOwnProperty.call(watched.folders, folder)) return;
        const state: ProjfsWatchedFolder = {
            files: getFolderFiles(watched.project.getFiles(), folder),
            burst: new NotificationBurst<ProjfsBurst>(PROJFS_NOTIFY_DEBOUNCE_MS, PROJFS_NOTIFY_MAX_DELAY_MS,
                () => ({ names: [], compare: false }), burst => this.notifySubscribers(folder, state, burst), this.now, this.delay),
        };
        watched.folders[folder] = state;
    }

    /**
     * Ends every subscription, stops listening to the project they were made
     * in, and drops the host's references to it. Call when the open project
     * closes.
     */
    close() {
        this.unwatch();
    }

    /** Stops listening for changes, ends every subscription, and drops the pending notifications. */
    protected unwatch() {
        if (this.watched) {
            this.watched.project.removeChangeListener(this.onFileChange);
            for (const folder of Object.keys(this.watched.folders)) this.watched.folders[folder].burst.drop();
        }
        this.watched = undefined;
        this.subscribers = [];
    }

    protected onFileChange = (name: string | undefined) => {
        const folders = this.watched?.folders || {};
        for (const folder of Object.keys(folders)) {
            if (name === undefined || name === pxt.CONFIG_NAME) {
                folders[folder].burst.add(burst => {
                    burst.compare = true;
                });
                continue;
            }
            const relative = name.slice(folder.length + 1);
            if (!name.startsWith(folder + "/") || getFolderFileName(folder, relative) !== name) continue;
            folders[folder].burst.add(burst => {
                if (burst.names.indexOf(relative) < 0) burst.names.push(relative);
            });
        }
    }

    /**
     * Notifies the subscribers of `folder` whose frames are still in the
     * document of the names `burst` changed, and drops the subscribers whose
     * frames have been removed; sends nothing if there are none. Ends the
     * subscriptions instead if the open project is no longer the one they
     * were made in, or its files can no longer be read; a read failure is
     * reported, not raised.
     * @param state the folder's state `burst` was started for; nothing is sent if the host no longer holds it
     */
    protected notifySubscribers(folder: string, state: ProjfsWatchedFolder, burst: ProjfsBurst) {
        const watched = this.watched;
        if (!watched || watched.folders[folder] !== state) return;
        const names = burst.names;
        try {
            if (this.getProject() !== watched.project) {
                this.unwatch();
                return;
            }
            const files = getFolderFiles(watched.project.getFiles(), folder);
            if (burst.compare) {
                for (const name of getChangedFolderFiles(state.files, files))
                    if (names.indexOf(name) < 0) names.push(name);
            }
            state.files = files;
        } catch (e) {
            pxt.reportException(e);
            this.unwatch();
            return;
        }
        if (!names.length) return;
        const notification: ProjfsNotification = { type: PROJFS_MESSAGE_TYPE, subtype: "changed", names };
        this.subscribers = this.subscribers.filter(s => s.frame.isConnected);
        for (const subscriber of this.subscribers) {
            if (subscriber.folder === folder) subscriber.reply(notification);
        }
    }
}
