import {
    PROJASSETS_MESSAGE_TYPE,
    ProjassetsAsset,
    ProjassetsErrorCode,
    ProjassetsImage,
    ProjassetsKind,
    ProjassetsNotification,
    ProjassetsReply,
    ProjassetsRequest,
    ProjassetsSong,
    ProjassetsVisualConfig,
} from "../../pxtservices/projassets";
import { getProjectSimulatorThemePreference } from "./simulatorTheme";
import { monotonicNow, SlidingWindowAdmission } from "./slidingWindowAdmission";

/**
 * The most list requests from the frames of one GitHub repository's
 * simulator extensions that are answered within
 * {@link PROJASSETS_LIST_RATE_WINDOW_MS}; later ones wait for the window to
 * allow them.
 */
export const PROJASSETS_LIST_RATE_LIMIT = 30;

/** The sliding window, in milliseconds, over which {@link PROJASSETS_LIST_RATE_LIMIT} applies. */
export const PROJASSETS_LIST_RATE_WINDOW_MS = 10000;

/**
 * Returns the image assets of `project` as simulator extensions see them: every
 * image in the project's own assets, named by the key of its entry in the
 * project's asset file. Images supplied by extensions are not included.
 */
export function getImageAssets(project: pxt.TilemapProject): ProjassetsImage[] {
    return project.getAssets(pxt.AssetType.Image).map(image => {
        const listed: ProjassetsImage = {
            kind: "image",
            // the key under which the project's asset file stores the image
            id: image.id.substr(image.id.lastIndexOf(".") + 1),
            width: image.bitmap.width,
            height: image.bitmap.height,
            data: image.jresData,
        };
        if (image.meta.displayName) listed.displayName = image.meta.displayName;
        return listed;
    });
}

/**
 * Returns the song assets of `project` as simulator extensions see them: every
 * song in the project's own assets, named by the key of its entry in the
 * project's asset file. Songs supplied by extensions are not included.
 */
export function getSongAssets(project: pxt.TilemapProject): ProjassetsSong[] {
    return project.getAssets(pxt.AssetType.Song).map(song => {
        const listed: ProjassetsSong = {
            kind: "song",
            // the key under which the project's asset file stores the song
            id: song.id.substr(song.id.lastIndexOf(".") + 1),
        };
        if (song.meta.displayName) listed.displayName = song.meta.displayName;
        return listed;
    });
}

/**
 * Returns the visual configuration of the project whose main package is
 * `project`, as the editor resolves it: the package's effective palette, and
 * the simulator theme the project settings page shows for it -- the
 * project's own theme resolved over `accountTheme`, else `accountTheme`.
 * @param presets the target's simulator theme presets; without any, the configuration has no theme
 * @param accountTheme the user's effective simulator theme
 */
export function getVisualConfig(
    project: pxt.Package,
    presets: pxt.SimulatorThemePreset[] | undefined,
    accountTheme: pxt.SimulatorTheme | undefined
): ProjassetsVisualConfig {
    const config: ProjassetsVisualConfig = { palette: (project.effectivePalette() || []).slice() };
    if (presets?.length && accountTheme) {
        const projectPreference = getProjectSimulatorThemePreference(project.config.theme, presets, accountTheme);
        config.theme = { ...(projectPreference?.theme || accountTheme) };
    }
    return config;
}

/** The open project's configuration, as the asset host reads and watches it. */
export interface ProjassetsConfig {
    /** Returns the project's name as it is now. */
    getName(): string;
    /** Returns the project's visual configuration as it is now. */
    getVisualConfig(): ProjassetsVisualConfig;
    /**
     * Adds a listener called each time the project's name or visual
     * configuration may have changed: its pxt.json is reloaded, or the user's
     * simulator theme preference may have changed, whether or not either did.
     */
    addChangeListener(listener: () => void): void;
    /** Removes a listener added with addChangeListener. */
    removeChangeListener(listener: () => void): void;
}

/** The user's simulator theme, as the asset host reads and watches it. */
export interface ProjassetsAccountTheme {
    /** Returns the user's effective simulator theme. */
    get(): pxt.SimulatorTheme | undefined;
    /** Adds a listener called each time the user's simulator theme preference may have changed, whether or not it did. */
    addChangeListener(listener: () => void): void;
    /** Removes a listener added with addChangeListener. */
    removeChangeListener(listener: () => void): void;
}

/**
 * Returns the configuration of the project whose main package is `mainPkg`,
 * as the asset host reads and watches it; its theme is resolved against the
 * target's simulator theme presets as they are when it is read.
 * @param accountTheme the user's simulator theme
 */
export function createProjassetsConfig(
    mainPkg: pxt.MainPackage,
    accountTheme: ProjassetsAccountTheme
): ProjassetsConfig {
    return {
        getName: () => mainPkg.config.name,
        getVisualConfig: () => getVisualConfig(mainPkg, pxt.appTarget.simulator?.themePresets, accountTheme.get()),
        addChangeListener: listener => {
            mainPkg.addConfigLoadListener(listener);
            accountTheme.addChangeListener(listener);
        },
        removeChangeListener: listener => {
            mainPkg.removeConfigLoadListener(listener);
            accountTheme.removeChangeListener(listener);
        },
    };
}

/**
 * The open project as the asset host waits on it. The host reads a project
 * only once it has loaded and while it is still the open one: a project read
 * before its load has no assets yet.
 */
export interface ProjassetsOpenProject {
    /**
     * Returns a promise that resolves once the project has loaded, and
     * rejects if its load fails. It settles even if the project is replaced
     * while loading.
     */
    loadedAsync(): Promise<void>;
}

/** A frame that subscribes to change notifications, as the asset host checks it. */
export interface ProjassetsFrame {
    /** False once the frame has been removed from the document. */
    readonly isConnected: boolean;
}

// per asset kind the host lists: returns the project's assets of that kind
const listers: { [K in ProjassetsKind]: (project: pxt.TilemapProject) => ProjassetsAsset[] } = {
    image: getImageAssets,
    song: getSongAssets,
};

class ProjassetsRequestError extends Error {
    constructor(public readonly code: ProjassetsErrorCode, message: string) {
        super(message);
    }
}

/**
 * Serves the project-asset requests of simulator extensions: lists the named
 * assets of the open project by kind, with its name and visual configuration,
 * and notifies subscribed frames when those assets, that name or that
 * configuration change. Every request gets one reply. A request applies to
 * the project open when it arrives, and is answered once that project has
 * loaded. A frame holds at most one subscription, which ends when the
 * project it was made in closes, or when the frame is removed.
 *
 * The list requests of the extensions of one GitHub repository, `owner/repo`
 * whatever subfolder their keys name, wait in one queue and are answered in
 * the order they arrive; those beyond {@link PROJASSETS_LIST_RATE_LIMIT}
 * within {@link PROJASSETS_LIST_RATE_WINDOW_MS} wait, with the list requests
 * behind them, until the window allows them. A list request whose project
 * has closed by the time its turn comes is refused with `PROJECT_CLOSED`.
 * Subscribe requests are neither queued nor limited.
 *
 * The host listens to one project at a time, the one its subscriptions were
 * made in, and lets go of it when it closes. Changes are merged: subscribers
 * get one notification, sent from a later task, for all the changes made
 * before it is sent.
 */
export class ProjassetsHost {
    // the subscribed frames, each once, with the function that delivers its notifications
    protected subscribers: { frame: ProjassetsFrame, reply: (msg: ProjassetsNotification) => void }[] = [];
    // the project every subscription was made in, which the host listens to, with
    // its asset project, configuration, and name and visual configuration as
    // last seen, serialized; undefined while there is none
    protected watched: { open: ProjassetsOpenProject, assets: pxt.TilemapProject, config: ProjassetsConfig, seen: string } | undefined;
    // true while a notification is scheduled
    protected notifyScheduled = false;
    // true once an asset change is waiting for the scheduled notification
    protected assetsChanged = false;
    // per repository: settles once every list request received from it has been answered
    protected listTails: pxt.Map<Promise<void>> = {};
    // per repository: admits each list request under the rate limit
    protected readonly lists: SlidingWindowAdmission;

    /**
     * @param getOpenProject returns the open project, or undefined if none is open
     * @param getProject returns the asset project of the open project; called only once it has loaded
     * @param getConfig returns the configuration of the open project; called only once it has loaded
     * @param now returns the current time in milliseconds on a clock that never
     * goes back; defaults to `performance.now()` where available, else `Date.now()`
     * @param delay returns a promise that resolves after the given number of milliseconds
     */
    constructor(
        protected readonly getOpenProject: () => ProjassetsOpenProject | undefined,
        protected readonly getProject: () => pxt.TilemapProject,
        protected readonly getConfig: () => ProjassetsConfig,
        now: () => number = monotonicNow,
        delay: (ms: number) => Promise<void> = ms => pxt.Util.delay(ms)
    ) {
        this.lists = new SlidingWindowAdmission(PROJASSETS_LIST_RATE_LIMIT, PROJASSETS_LIST_RATE_WINDOW_MS, now, delay);
    }

    /**
     * Answers a request from the simulator extension with the given key,
     * once the project open when it arrives has loaded. A subscribe request
     * also subscribes `frame`, whose notifications `reply` delivers, until
     * the project closes or the frame is removed; subscribing again from
     * the same frame changes nothing.
     * @param key the extension key the requesting frame was created for
     * @param msg the request, as received
     * @param reply delivers a reply or notification to the requesting frame
     * @param frame the requesting frame
     * @returns a promise that resolves once the reply is sent
     */
    async handleMessageAsync(
        key: string,
        msg: unknown,
        reply: (msg: ProjassetsReply | ProjassetsNotification) => void,
        frame: ProjassetsFrame
    ): Promise<void> {
        const request = msg as ProjassetsRequest;
        const id = typeof request?.id === "string" ? request.id : undefined;
        let answer: ProjassetsReply;
        try {
            answer = { ...await this.applyAsync(key, request, reply, frame), type: PROJASSETS_MESSAGE_TYPE, id } as ProjassetsReply;
        } catch (e) {
            const code: ProjassetsErrorCode = e instanceof ProjassetsRequestError ? e.code : "FAILED";
            answer = { type: PROJASSETS_MESSAGE_TYPE, id, subtype: "error", code, message: e?.message || String(e) };
        }
        reply(answer);
    }

    protected async applyAsync(key: string, request: ProjassetsRequest, reply: (msg: ProjassetsNotification) => void, frame: ProjassetsFrame): Promise<ProjassetsReplyBody> {
        switch (request?.subtype) {
            case "list": {
                const kind: unknown = request.kind;
                if (typeof kind !== "string")
                    throw new ProjassetsRequestError("INVALID_REQUEST", "The kind must be a string.");
                if (!Object.prototype.hasOwnProperty.call(listers, kind))
                    throw new ProjassetsRequestError("UNSUPPORTED_KIND", `The editor does not list ${kind} assets.`);
                return this.listAsync(key, kind as ProjassetsKind, this.getOpenProject());
            }

            case "subscribe": {
                this.watch(await this.openProjectAsync());
                this.subscribers = this.subscribers.filter(s => s.frame.isConnected);
                if (!this.subscribers.some(s => s.frame === frame)) this.subscribers.push({ frame, reply });
                return { subtype: "ack" };
            }

            default:
                throw new ProjassetsRequestError("INVALID_REQUEST", `Unknown request ${(request as any)?.subtype}.`);
        }
    }

    /**
     * Queues a list request from the extension registered under `key` behind
     * the list requests already received from its repository, waits for the
     * rate limit to admit it, and returns the listing of `kind` in `open`.
     * @param open the project open when the request arrived
     */
    protected listAsync(key: string, kind: ProjassetsKind, open: ProjassetsOpenProject | undefined): Promise<ProjassetsReplyBody> {
        const repository = pxt.github.parseRepoId(key)?.slug || key;
        const listed = (this.listTails[repository] || Promise.resolve()).then(async (): Promise<ProjassetsReplyBody> => {
            await this.lists.admitAsync(repository, () => this.throwIfClosed(open));
            const { assets: project, config } = await this.openProjectAsync(open);
            return {
                subtype: "assets",
                kind,
                assets: listers[kind](project),
                name: config.getName(),
                ...config.getVisualConfig(),
            };
        });
        this.listTails[repository] = listed.then(() => { }, () => { });
        return listed;
    }

    /**
     * Does nothing while `open` is still the open project.
     * @throws a `PROJECT_CLOSED` refusal if `open` is undefined or has been replaced
     */
    protected throwIfClosed(open: ProjassetsOpenProject | undefined) {
        if (!open)
            throw new ProjassetsRequestError("PROJECT_CLOSED", "No project was open when the request arrived.");
        if (this.getOpenProject() !== open)
            throw new ProjassetsRequestError("PROJECT_CLOSED", "The project open when the request arrived has been replaced.");
    }

    /**
     * Waits for `open` to load, then returns it with its assets and
     * configuration.
     * @param open the project open when the request arrived; defaults to the project open now
     * @throws a `PROJECT_CLOSED` refusal if `open` is undefined, or if it
     * fails to load or is replaced before it has loaded
     */
    protected async openProjectAsync(open = this.getOpenProject()): Promise<{ open: ProjassetsOpenProject, assets: pxt.TilemapProject, config: ProjassetsConfig }> {
        if (!open)
            throw new ProjassetsRequestError("PROJECT_CLOSED", "No project was open when the request arrived.");
        try {
            await open.loadedAsync();
        } catch (e) {
            throw new ProjassetsRequestError("PROJECT_CLOSED", "The project open when the request arrived failed to load.");
        }
        if (this.getOpenProject() !== open)
            throw new ProjassetsRequestError("PROJECT_CLOSED", "The project open when the request arrived was replaced while it loaded.");
        return { open, assets: this.getProject(), config: this.getConfig() };
    }

    /** Listens to `project` for changes, ending the subscriptions made in any other project. */
    protected watch(project: { open: ProjassetsOpenProject, assets: pxt.TilemapProject, config: ProjassetsConfig }) {
        if (this.watched?.open === project.open) return;
        this.unwatch();
        project.assets.addProjectChangeListener(this.onProjectChange);
        project.config.addChangeListener(this.onConfigChange);
        this.watched = { ...project, seen: serializeConfig(project.config) };
    }

    /**
     * Ends every subscription, stops listening to the project they were made
     * in, and drops the host's references to it. Call when the open project
     * closes.
     */
    close() {
        this.unwatch();
    }

    /** Stops listening for changes and ends every subscription. */
    protected unwatch() {
        this.watched?.assets.removeProjectChangeListener(this.onProjectChange);
        this.watched?.config.removeChangeListener(this.onConfigChange);
        this.watched = undefined;
        this.subscribers = [];
    }

    protected onProjectChange = () => {
        this.assetsChanged = true;
        this.scheduleNotification();
    }

    protected onConfigChange = () => {
        this.scheduleNotification();
    }

    protected scheduleNotification() {
        if (this.notifyScheduled) return;
        this.notifyScheduled = true;
        setTimeout(() => this.notifySubscribers(), 0);
    }

    /**
     * Notifies every subscriber whose frame is still in the document, and
     * drops the others, if the assets, the name or the visual configuration
     * changed; or ends the subscriptions if the open project is no longer the
     * one they were made in, or its configuration can no longer be read. A
     * read failure is reported, not raised.
     */
    protected notifySubscribers() {
        this.notifyScheduled = false;
        const assetsChanged = this.assetsChanged;
        this.assetsChanged = false;
        if (!this.watched) return;
        let seen: string;
        try {
            if (this.getOpenProject() !== this.watched.open) {
                this.unwatch();
                return;
            }
            seen = serializeConfig(this.watched.config);
        } catch (e) {
            pxt.reportException(e);
            this.unwatch();
            return;
        }
        const configChanged = seen !== this.watched.seen;
        this.watched.seen = seen;
        if (!assetsChanged && !configChanged) return;
        const notification: ProjassetsNotification = { type: PROJASSETS_MESSAGE_TYPE, subtype: "changed" };
        this.subscribers = this.subscribers.filter(s => s.frame.isConnected);
        for (const subscriber of this.subscribers) subscriber.reply(notification);
    }
}

/** Returns the name and visual configuration of `config` as they are now, serialized for comparison. */
function serializeConfig(config: ProjassetsConfig): string {
    return JSON.stringify({ name: config.getName(), visual: config.getVisualConfig() });
}

/** A reply without the `type` and `id` fields every reply carries. */
type ProjassetsReplyBody<R = ProjassetsReply> = R extends ProjassetsReply ? Omit<R, "type" | "id"> : never;
