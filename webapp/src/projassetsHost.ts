import {
    PROJASSETS_MESSAGE_TYPE,
    ProjassetsAnimation,
    ProjassetsAssetOfKind,
    ProjassetsErrorCode,
    ProjassetsImage,
    ProjassetsJson,
    ProjassetsKind,
    ProjassetsNotification,
    ProjassetsReply,
    ProjassetsRequest,
    ProjassetsSong,
    ProjassetsTile,
    ProjassetsTilemap,
    ProjassetsTilesetTile,
    ProjassetsVisualConfig,
} from "../../pxtservices/projassets";
import { getProjectSimulatorThemePreference } from "./simulatorTheme";
import { SlidingWindowAdmission } from "./slidingWindowAdmission";
import {
    caughtErrorReply,
    getSimxRepository,
    loadedOpenProjectAsync,
    openProjectOrThrow,
    requestId,
    SimxReplyBody,
    SimxRequestError,
} from "./simxRequests";

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
 * The time, in milliseconds, after the last change of a burst at which
 * subscribed frames are notified of it, unless
 * {@link PROJASSETS_NOTIFY_MAX_DELAY_MS} comes first.
 */
export const PROJASSETS_NOTIFY_DEBOUNCE_MS = 250;

/**
 * The longest time, in milliseconds, after the first change of a burst at
 * which subscribed frames are notified of it, however long its changes go on.
 */
export const PROJASSETS_NOTIFY_MAX_DELAY_MS = 2000;

/** Returns the key under which the project's asset file stores the asset with the qualified id `id`. */
function assetFileKey(id: string): string {
    return id.substr(id.lastIndexOf(".") + 1);
}

/**
 * Returns the image assets of `project` as simulator extensions see them: every
 * image in the project's own assets, named by the key of its entry in the
 * project's asset file.
 */
export function getImageAssets(project: pxt.TilemapProject): ProjassetsImage[] {
    return project.getAssets(pxt.AssetType.Image).map(image => {
        const listed: ProjassetsImage = {
            kind: "image",
            id: assetFileKey(image.id),
            width: image.bitmap.width,
            height: image.bitmap.height,
            data: image.jresData,
        };
        if (image.meta.displayName) listed.displayName = image.meta.displayName;
        return listed;
    });
}

/**
 * Returns the tile assets of `project` as simulator extensions see them: every
 * tile in the project's own assets, the blank tile of each tile width
 * included, named by its qualified id.
 */
export function getTileAssets(project: pxt.TilemapProject): ProjassetsTile[] {
    return project.getAssets(pxt.AssetType.Tile).map(tile => {
        const listed: ProjassetsTile = {
            kind: "tile",
            id: tile.id,
            width: tile.bitmap.width,
            height: tile.bitmap.height,
            data: tile.jresData,
        };
        if (tile.meta.displayName) listed.displayName = tile.meta.displayName;
        return listed;
    });
}

/**
 * Returns the tilemap assets of `project` as simulator extensions see them:
 * every tilemap in the project's own assets, empty and unused ones included,
 * with its data and tileset as the project's tileset file stores them, each
 * tileset tile joined to the tile the project resolves its id to.
 */
export function getTilemapAssets(project: pxt.TilemapProject): ProjassetsTilemap[] {
    const jres: pxt.Map<pxt.JRes> = project.getProjectTilesetJRes();
    const listed: ProjassetsTilemap[] = [];
    for (const key of Object.keys(jres)) {
        const entry = jres[key];
        if (entry.mimeType !== pxt.TILEMAP_MIME_TYPE) continue;
        const tilemap = project.getTilemap(entry.id).data;
        listed.push({
            kind: "tilemap",
            id: entry.id,
            displayName: entry.displayName,
            tileWidth: tilemap.tileset.tileWidth,
            width: tilemap.tilemap.width,
            height: tilemap.tilemap.height,
            data: entry.data,
            tileset: entry.tileset.map(id => getTilesetTile(project, id)),
        });
    }
    return listed;
}

/** Returns the tileset tile `id` names, with the pixels of the tile `project` resolves it to, if any. */
function getTilesetTile(project: pxt.TilemapProject, id: string): ProjassetsTilesetTile {
    const tile = project.resolveTile(id);
    if (!tile) return { id };
    return { id, width: tile.bitmap.width, height: tile.bitmap.height, data: tile.jresData };
}

/**
 * Returns the animation assets of `project` as simulator extensions see them:
 * every animation in the project's own assets, named by the key of its entry
 * in the project's asset file.
 */
export function getAnimationAssets(project: pxt.TilemapProject): ProjassetsAnimation[] {
    return project.getAssets(pxt.AssetType.Animation).map(animation => {
        const listed: ProjassetsAnimation = {
            kind: "animation",
            id: assetFileKey(animation.id),
            width: animation.frames[0].width,
            height: animation.frames[0].height,
            interval: animation.interval,
            frames: animation.frames.map(frame => pxt.sprite.base64EncodeBitmap(frame)),
        };
        if (animation.meta.displayName) listed.displayName = animation.meta.displayName;
        return listed;
    });
}

/**
 * Returns the song assets of `project` as simulator extensions see them: every
 * song in the project's own assets, named by the key of its entry in the
 * project's asset file.
 */
export function getSongAssets(project: pxt.TilemapProject): ProjassetsSong[] {
    return project.getAssets(pxt.AssetType.Song).map(song => {
        const listed: ProjassetsSong = {
            kind: "song",
            id: assetFileKey(song.id),
            data: pxt.assets.music.encodeSongToHex(song.song),
        };
        if (song.meta.displayName) listed.displayName = song.meta.displayName;
        return listed;
    });
}

/**
 * Returns the JSON assets of `project` as simulator extensions see them: every
 * JSON asset in the project's own assets, named by the key of its entry in the
 * project's asset file.
 */
export function getJsonAssets(project: pxt.TilemapProject): ProjassetsJson[] {
    return project.getAssets(pxt.AssetType.Json).map(asset => {
        const listed: ProjassetsJson = {
            kind: "json",
            id: assetFileKey(asset.id),
            data: asset.data,
        };
        if (asset.meta.displayName) listed.displayName = asset.meta.displayName;
        if (asset.fileName) listed.fileName = asset.fileName;
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
const listers: { [K in ProjassetsKind]: (project: pxt.TilemapProject) => ProjassetsAssetOfKind[K][] } = {
    image: getImageAssets,
    tile: getTileAssets,
    tilemap: getTilemapAssets,
    animation: getAnimationAssets,
    song: getSongAssets,
    json: getJsonAssets,
};

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
 * in any letter case, whatever subfolder their keys name, wait in one queue
 * and are answered in the order they arrive; those beyond
 * {@link PROJASSETS_LIST_RATE_LIMIT} within {@link PROJASSETS_LIST_RATE_WINDOW_MS}
 * wait, with the list requests behind them, until the window allows them. A
 * list request whose project has closed by the time its turn comes is
 * refused with `PROJECT_CLOSED`, and one whose key names no repository with
 * `UNREGISTERED`. Subscribe requests are neither queued nor limited.
 *
 * The host listens to one project at a time, the one its subscriptions were
 * made in, and lets go of it when it closes. Changes are merged: subscribers
 * get one notification for all the changes made before it is sent, sent
 * {@link PROJASSETS_NOTIFY_DEBOUNCE_MS} after the last of them, or
 * {@link PROJASSETS_NOTIFY_MAX_DELAY_MS} after the first if that is sooner. A
 * notification pending when the project closes is not sent.
 */
export class ProjassetsHost {
    // the subscribed frames, each once, with the function that delivers its notifications
    protected subscribers: { frame: ProjassetsFrame, reply: (msg: ProjassetsNotification) => void }[] = [];
    // the project every subscription was made in, which the host listens to, with
    // its asset project, configuration, and name and visual configuration as
    // last seen, serialized; undefined while there is none
    protected watched: { open: ProjassetsOpenProject, assets: pxt.TilemapProject, config: ProjassetsConfig, seen: string } | undefined;
    // the notification waiting to be sent; undefined while none is
    protected pending: PendingNotification | undefined;
    // per repository: the list requests received from it, each until it has been answered
    protected readonly queue = new pxt.Util.PromiseQueue();
    // per repository: admits each list request under the rate limit
    protected readonly lists: SlidingWindowAdmission;

    /**
     * @param getOpenProject returns the open project, or undefined if none is open
     * @param getProject returns the asset project of the open project; called only once it has loaded
     * @param getConfig returns the configuration of the open project; called only once it has loaded
     * @param now returns the current time in milliseconds on a clock that never
     * goes back; defaults to `pxt.Util.monotonicNow`
     * @param delay returns a promise that resolves after the given number of milliseconds
     */
    constructor(
        protected readonly getOpenProject: () => ProjassetsOpenProject | undefined,
        protected readonly getProject: () => pxt.TilemapProject,
        protected readonly getConfig: () => ProjassetsConfig,
        protected readonly now: () => number = pxt.Util.monotonicNow,
        protected readonly delay: (ms: number) => Promise<void> = ms => pxt.Util.delay(ms)
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
        const id = requestId(msg);
        let answer: ProjassetsReply;
        try {
            answer = { ...await this.applyAsync(key, request, reply, frame), type: PROJASSETS_MESSAGE_TYPE, id } as ProjassetsReply;
        } catch (e) {
            answer = caughtErrorReply<typeof PROJASSETS_MESSAGE_TYPE, ProjassetsErrorCode>(PROJASSETS_MESSAGE_TYPE, id, e);
        }
        reply(answer);
    }

    protected async applyAsync(key: string, request: ProjassetsRequest, reply: (msg: ProjassetsNotification) => void, frame: ProjassetsFrame): Promise<SimxReplyBody<ProjassetsReply>> {
        switch (request?.subtype) {
            case "list": {
                const kind: unknown = request.kind;
                if (typeof kind !== "string")
                    throw new SimxRequestError<ProjassetsErrorCode>("INVALID_REQUEST", "The kind must be a string.");
                if (!Object.prototype.hasOwnProperty.call(listers, kind))
                    throw new SimxRequestError<ProjassetsErrorCode>("UNSUPPORTED_KIND", `The editor does not list ${kind} assets.`);
                return this.listAsync(key, kind as ProjassetsKind, this.getOpenProject());
            }

            case "subscribe": {
                this.watch(await this.readProjectAsync(this.getOpenProject()));
                this.subscribers = this.subscribers.filter(s => s.frame.isConnected);
                if (!this.subscribers.some(s => s.frame === frame)) this.subscribers.push({ frame, reply });
                return { subtype: "ack" };
            }

            default:
                throw new SimxRequestError<ProjassetsErrorCode>("INVALID_REQUEST", `Unknown request ${(request as any)?.subtype}.`);
        }
    }

    /**
     * Queues a list request from the extension registered under `key` behind
     * the list requests already received from its repository, waits for the
     * rate limit to admit it, and returns the listing of `kind` in `open`.
     * @param open the project open when the request arrived
     * @throws an `UNREGISTERED` refusal if `key` names no GitHub repository
     */
    protected listAsync(key: string, kind: ProjassetsKind, open: ProjassetsOpenProject | undefined): Promise<SimxReplyBody<ProjassetsReply>> {
        const repository = getSimxRepository(key);
        if (repository === undefined)
            return Promise.reject(new SimxRequestError<ProjassetsErrorCode>("UNREGISTERED", `${key} names no GitHub repository.`));
        return this.queue.enqueue(repository, async (): Promise<SimxReplyBody<ProjassetsReply>> => {
            await this.lists.admitAsync(repository, () => openProjectOrThrow(open, () => this.getOpenProject()));
            const { assets: project, config } = await this.readProjectAsync(open);
            return {
                subtype: "assets",
                kind,
                assets: listers[kind](project),
                name: config.getName(),
                ...config.getVisualConfig(),
            };
        });
    }

    /**
     * Waits for `open` to load, then returns it with its assets and
     * configuration.
     * @param open the project open when the request arrived
     * @throws a `PROJECT_CLOSED` refusal if `open` is undefined, fails to
     * load, or is no longer the open project once it has loaded
     */
    protected async readProjectAsync(open: ProjassetsOpenProject | undefined): Promise<{ open: ProjassetsOpenProject, assets: pxt.TilemapProject, config: ProjassetsConfig }> {
        const loaded = await loadedOpenProjectAsync(open, () => this.getOpenProject());
        return { open: loaded, assets: this.getProject(), config: this.getConfig() };
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

    /** Stops listening for changes, ends every subscription, and drops the pending notification. */
    protected unwatch() {
        this.watched?.assets.removeProjectChangeListener(this.onProjectChange);
        this.watched?.config.removeChangeListener(this.onConfigChange);
        this.watched = undefined;
        this.subscribers = [];
        this.pending = undefined;
    }

    protected onProjectChange = () => {
        this.scheduleNotification(true);
    }

    protected onConfigChange = () => {
        this.scheduleNotification(false);
    }

    /**
     * Adds a change to the pending notification's burst, or starts a burst with it.
     * @param assetsChanged true for a change to the project's assets
     */
    protected scheduleNotification(assetsChanged: boolean) {
        const now = this.now();
        if (this.pending) {
            this.pending.last = now;
            if (assetsChanged) this.pending.assetsChanged = true;
            return;
        }
        this.pending = { first: now, last: now, assetsChanged };
        this.notifyWhenDueAsync(this.pending);
    }

    /**
     * Waits until `pending` is due, then notifies the subscribers of it;
     * returns without notifying once `pending` is no longer the pending
     * notification.
     */
    protected async notifyWhenDueAsync(pending: PendingNotification) {
        for (;;) {
            const wait = Math.min(pending.last + PROJASSETS_NOTIFY_DEBOUNCE_MS, pending.first + PROJASSETS_NOTIFY_MAX_DELAY_MS) - this.now();
            if (wait <= 0) break;
            await this.delay(wait);
            if (this.pending !== pending) return;
        }
        this.pending = undefined;
        this.notifySubscribers(pending.assetsChanged);
    }

    /**
     * Notifies every subscriber whose frame is still in the document, and
     * drops the others, if the assets, the name or the visual configuration
     * changed; or ends the subscriptions if the open project is no longer the
     * one they were made in, or its configuration can no longer be read. A
     * read failure is reported, not raised.
     * @param assetsChanged true if the assets changed since the last notification
     */
    protected notifySubscribers(assetsChanged: boolean) {
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

/** A burst of changes subscribers are to be notified of. */
interface PendingNotification {
    /** When the burst's first change was made, in milliseconds on the host's clock. */
    first: number;
    /** When the burst's latest change was made, in milliseconds on the host's clock. */
    last: number;
    /** True if any change of the burst was to the project's assets. */
    assetsChanged: boolean;
}

/** Returns the name and visual configuration of `config` as they are now, serialized for comparison. */
function serializeConfig(config: ProjassetsConfig): string {
    return JSON.stringify({ name: config.getName(), visual: config.getVisualConfig() });
}
