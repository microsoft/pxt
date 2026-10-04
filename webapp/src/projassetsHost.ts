import {
    PROJASSETS_MESSAGE_TYPE,
    ProjassetsAsset,
    ProjassetsErrorCode,
    ProjassetsImage,
    ProjassetsKind,
    ProjassetsNotification,
    ProjassetsReply,
    ProjassetsRequest,
    ProjassetsVisualConfig,
} from "../../pxtservices/projassets";
import { getProjectSimulatorThemePreference } from "./simulatorTheme";

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
    /** Returns the project's visual configuration as it is now. */
    getVisualConfig(): ProjassetsVisualConfig;
    /** Adds a listener called each time the project's pxt.json is reloaded, whether or not it changed. */
    addConfigLoadListener(listener: () => void): void;
    /** Removes a listener added with addConfigLoadListener. */
    removeConfigLoadListener(listener: () => void): void;
}

/**
 * Returns the configuration of the project whose main package is `mainPkg`,
 * as the asset host reads and watches it; its theme is resolved against the
 * target's simulator theme presets as they are when it is read.
 * @param getAccountTheme returns the user's effective simulator theme
 */
export function createProjassetsConfig(
    mainPkg: pxt.MainPackage,
    getAccountTheme: () => pxt.SimulatorTheme | undefined
): ProjassetsConfig {
    return {
        getVisualConfig: () => getVisualConfig(mainPkg, pxt.appTarget.simulator?.themePresets, getAccountTheme()),
        addConfigLoadListener: listener => mainPkg.addConfigLoadListener(listener),
        removeConfigLoadListener: listener => mainPkg.removeConfigLoadListener(listener),
    };
}

// PR NOTE [Issue 5] -- lift into the PR description, then remove.
// The provider reads a project only once it has loaded. A reload (the
// palette editor's Apply, an extension change, opening another project)
// replaces the main package and editor package, and the new editor package
// has its header before its files and pxt.json arrive. The webapp's asset
// project getter (pxt.react.getTilemapProject) builds the TilemapProject on
// first use and keeps it; built from a package that has not loaded, it is
// empty and marked for rebuild, and the next asset build writes that empty
// project over images.g.jres and tilemap.g.jres. Stock pxt never asks for
// the asset project before the load completes, but simulator extension
// requests can arrive at any moment. So each request waits on the open
// editor package's loadedAsync, then checks the package is still the open
// one before reading it; a change notification compares the open package
// with the one its subscriptions were made in, and reads nothing from any
// other.
/** The open project as the asset host waits on it. */
export interface ProjassetsOpenProject {
    /**
     * Returns a promise that resolves once the project has loaded, and
     * rejects if its load fails. It settles even if the project is replaced
     * while loading.
     */
    loadedAsync(): Promise<void>;
}

// per asset kind the host lists: returns the project's assets of that kind
const listers: { [K in ProjassetsKind]: (project: pxt.TilemapProject) => ProjassetsAsset[] } = {
    image: getImageAssets,
};

class ProjassetsRequestError extends Error {
    constructor(public readonly code: ProjassetsErrorCode, message: string) {
        super(message);
    }
}

// PR NOTE [Issue 5] -- lift into the PR description, then remove.
// The asset provider of Issue 5 (generated-docs/pxt-issue-drafts): a
// read-only, typed view of the open project's named assets and visual
// configuration (palette, simulator theme) for simulator extensions,
// answered from the live TilemapProject and package config, not from the
// asset files (images.g.jres), which are rebuilt only at build time. It
// rides the projfs plumbing: the driver attests the requesting frame's key
// and refuses frames whose registration lacks allowAssetRead before a
// request reaches this host. Change notifications ride the TilemapProject's
// project-wide change listener and the main package's config load listener,
// deferred and merged: a burst of edits yields one notification, sent after
// the edits have applied; a config reload notifies only when it changed the
// palette or the theme.
/**
 * Serves the project-asset requests of simulator extensions: lists the named
 * assets of the open project by kind, with its visual configuration, and
 * notifies subscribed extensions when those assets or that configuration
 * change. Every request gets one reply. A request applies to the project open
 * when it arrives, and is answered once that project has loaded; a
 * subscription ends when that project closes.
 *
 * The host listens to one project at a time, the one its subscriptions were
 * made in. Changes are merged: subscribers get one notification, sent from a
 * later task, for all the changes made before it is sent.
 */
export class ProjassetsHost {
    // per extension key: delivers change notifications to the extension's subscribed frame
    protected subscriptions: pxt.Map<(msg: ProjassetsNotification) => void> = {};
    // the project every subscription was made in, which the host listens to, with
    // its asset project, configuration and visual configuration as last seen,
    // serialized; undefined while there is none
    protected watched: { open: ProjassetsOpenProject, assets: pxt.TilemapProject, config: ProjassetsConfig, visual: string } | undefined;
    // true while a notification is scheduled
    protected notifyScheduled = false;
    // true once an asset change is waiting for the scheduled notification
    protected assetsChanged = false;

    /**
     * @param getOpenProject returns the open project, or undefined if none is open
     * @param getProject returns the asset project of the open project; called only once it has loaded
     * @param getConfig returns the configuration of the open project; called only once it has loaded
     */
    constructor(
        protected readonly getOpenProject: () => ProjassetsOpenProject | undefined,
        protected readonly getProject: () => pxt.TilemapProject,
        protected readonly getConfig: () => ProjassetsConfig
    ) {
    }

    /**
     * Answers a request from the simulator extension with the given key,
     * once the project open when it arrives has loaded. A subscribe request
     * also makes `reply` the extension's channel for change notifications,
     * replacing any channel it had.
     * @param key the extension key the requesting frame was created for
     * @param msg the request, as received
     * @param reply delivers a reply or notification to the requesting frame
     * @returns a promise that resolves once the reply is sent
     */
    async handleMessageAsync(key: string, msg: unknown, reply: (msg: ProjassetsReply | ProjassetsNotification) => void): Promise<void> {
        const request = msg as ProjassetsRequest;
        const id = typeof request?.id === "string" ? request.id : undefined;
        let answer: ProjassetsReply;
        try {
            answer = { ...await this.applyAsync(key, request, reply), type: PROJASSETS_MESSAGE_TYPE, id } as ProjassetsReply;
        } catch (e) {
            const code: ProjassetsErrorCode = e instanceof ProjassetsRequestError ? e.code : "FAILED";
            answer = { type: PROJASSETS_MESSAGE_TYPE, id, subtype: "error", code, message: e?.message || String(e) };
        }
        reply(answer);
    }

    protected async applyAsync(key: string, request: ProjassetsRequest, reply: (msg: ProjassetsNotification) => void): Promise<ProjassetsReplyBody> {
        switch (request?.subtype) {
            case "list": {
                const kind: unknown = request.kind;
                if (typeof kind !== "string")
                    throw new ProjassetsRequestError("INVALID_REQUEST", "The kind must be a string.");
                const { assets: project, config } = await this.openProjectAsync();
                if (!Object.prototype.hasOwnProperty.call(listers, kind))
                    throw new ProjassetsRequestError("UNSUPPORTED_KIND", `The editor does not list ${kind} assets.`);
                return {
                    subtype: "assets",
                    kind: kind as ProjassetsKind,
                    assets: listers[kind as ProjassetsKind](project),
                    ...config.getVisualConfig(),
                };
            }

            case "subscribe": {
                this.watch(await this.openProjectAsync());
                this.subscriptions[key] = reply;
                return { subtype: "ack" };
            }

            default:
                throw new ProjassetsRequestError("INVALID_REQUEST", `Unknown request ${(request as any)?.subtype}.`);
        }
    }

    /**
     * Waits for the project open now to load, then returns it with its assets
     * and configuration.
     * @throws a `PROJECT_CLOSED` refusal if no project is open, or if the
     * project fails to load or is replaced before it has loaded
     */
    protected async openProjectAsync(): Promise<{ open: ProjassetsOpenProject, assets: pxt.TilemapProject, config: ProjassetsConfig }> {
        const open = this.getOpenProject();
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
        project.config.addConfigLoadListener(this.onConfigLoad);
        this.watched = { ...project, visual: JSON.stringify(project.config.getVisualConfig()) };
    }

    /** Stops listening for changes and ends every subscription. */
    protected unwatch() {
        this.watched?.assets.removeProjectChangeListener(this.onProjectChange);
        this.watched?.config.removeConfigLoadListener(this.onConfigLoad);
        this.watched = undefined;
        this.subscriptions = {};
    }

    protected onProjectChange = () => {
        this.assetsChanged = true;
        this.scheduleNotification();
    }

    protected onConfigLoad = () => {
        this.scheduleNotification();
    }

    protected scheduleNotification() {
        if (this.notifyScheduled) return;
        this.notifyScheduled = true;
        setTimeout(() => this.notifySubscribers(), 0);
    }

    /**
     * Notifies every subscriber if the assets or the visual configuration
     * changed, or ends the subscriptions if the open project is no longer the
     * one they were made in, or its configuration can no longer be read; a
     * read failure is reported, not raised.
     */
    protected notifySubscribers() {
        this.notifyScheduled = false;
        const assetsChanged = this.assetsChanged;
        this.assetsChanged = false;
        if (!this.watched) return;
        let visual: string;
        try {
            if (this.getOpenProject() !== this.watched.open) {
                this.unwatch();
                return;
            }
            visual = JSON.stringify(this.watched.config.getVisualConfig());
        } catch (e) {
            pxt.reportException(e);
            this.unwatch();
            return;
        }
        const visualChanged = visual !== this.watched.visual;
        this.watched.visual = visual;
        if (!assetsChanged && !visualChanged) return;
        const notification: ProjassetsNotification = { type: PROJASSETS_MESSAGE_TYPE, subtype: "changed" };
        for (const key of Object.keys(this.subscriptions)) {
            this.subscriptions[key](notification);
        }
    }
}

/** A reply without the `type` and `id` fields every reply carries. */
type ProjassetsReplyBody<R = ProjassetsReply> = R extends ProjassetsReply ? Omit<R, "type" | "id"> : never;
