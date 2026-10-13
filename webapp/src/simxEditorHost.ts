import {
    SIMXEDITOR_MESSAGE_TYPE,
    SIMXEDITOR_PORT_MESSAGE_TYPE,
    SIMXEDITOR_ROLE,
    SimxEditorEvent,
    SimxEditorPortMessage,
    SimxEditorReply,
    SimxEditorSimulatorCommand,
    SimxEditorSimulatorState,
} from "../../pxtservices/simxeditor";

// PR NOTE [Issue 6] -- lift into the PR description, then remove.
// The editor side of simulator extension editor tabs: which registrations
// offer a tab to the open project, the tab frames themselves (one per
// registration, created on first selection, kept loaded and merely hidden
// across editor switches, removed only when the project closes), their
// lifecycle events, and the MessageChannel the editor brokers between a tab
// frame and the simulator frame of the same key. The simulator driver knows
// nothing of tab frames beyond finding one by its data-simxkey when it
// gates a request; it only reports its own simulator frames' loads.

/** The fields of a simulator extension registration, as the simulator driver resolved them, that its editor tab uses. */
export interface SimxEditorRegistrationConfig {
    editor?: { label: string; icon?: string };
    editorUrl?: string;
    iconUrl?: string;
    allowPopups?: boolean;
    allowClipboardWrite?: boolean;
    allowDownloads?: boolean;
}

/** A simulator extension's editor tab that the editor can offer. */
export interface SimxEditorRegistration {
    /** The extension's key, e.g. `owner/repo`. */
    key: string;
    /** The tab's name and accessible name. */
    label: string;
    /** The class names of a font icon shown before the label; undefined if the icon is an SVG, or there is none. */
    icon?: string;
    /** The URL of an SVG shown before the label, drawn in the label's color; undefined if the icon is a font icon, or there is none. */
    iconUrl?: string;
    /** The URL of the tab's page, without the parameters the editor adds. */
    url: string;
    /** The tab frame's sandbox gains allow-popups and allow-popups-to-escape-sandbox. */
    allowPopups?: boolean;
    /** The tab frame's allow list gains clipboard-write. */
    allowClipboardWrite?: boolean;
    /** The tab frame's sandbox gains allow-downloads. */
    allowDownloads?: boolean;
}

/**
 * Returns the editor tabs of `simulatorExtensions`, in registration order: those
 * the simulator driver resolved an `editorUrl` for, which it does only for a
 * permanent registration that declares an `editor` and sets `allowEditorTab`.
 */
export function getSimxEditorRegistrations(simulatorExtensions: pxt.Map<SimxEditorRegistrationConfig> | undefined): SimxEditorRegistration[] {
    return Object.keys(simulatorExtensions || {})
        .filter(key => !!simulatorExtensions[key]?.editorUrl)
        .map(key => {
            const simx = simulatorExtensions[key];
            return {
                key,
                label: simx.editor.label,
                // PR NOTE [Issue 6] -- lift into the PR description, then remove.
                // The driver resolves an iconUrl exactly when the icon is an
                // SVG path, so a tab carries either a font icon's class names
                // or an SVG's URL, never both.
                icon: simx.iconUrl ? undefined : simx.editor.icon,
                iconUrl: simx.iconUrl,
                url: simx.editorUrl,
                allowPopups: simx.allowPopups,
                allowClipboardWrite: simx.allowClipboardWrite,
                allowDownloads: simx.allowDownloads,
            };
        });
}

/**
 * Returns the registrations among `registrations` whose extension the project
 * includes: those whose key names the GitHub repository (`owner/repo`, in any
 * case) of one of `dependencies`, the version specs of the project's
 * dependencies, direct or not, such as `github:owner/repo/path#ref`.
 */
export function getProjectSimxEditors(registrations: SimxEditorRegistration[], dependencies: string[]): SimxEditorRegistration[] {
    const repos = dependencies
        .filter(dep => /^github:/i.test(dep || ""))
        .map(dep => pxt.github.parseRepoId(dep)?.slug?.toLowerCase())
        .filter(slug => !!slug);
    return registrations.filter(r => repos.indexOf(r.key.toLowerCase()) >= 0);
}

/**
 * Returns the name of the marker file that selects the editor tab of the
 * extension registered under `key`: a virtual, session-only file (see
 * `pxt.isSessionOnlyFile`) at the project's top level, named after the key,
 * with every `/` replaced by `~`, and ending in `pxt.SIMX_EDITOR_MARKER_SUFFIX`.
 */
export function getSimxEditorMarkerName(key: string): string {
    return key.replace(/\//g, "~") + pxt.SIMX_EDITOR_MARKER_SUFFIX;
}

/** Returns the key of the registration among `registrations` whose marker file is named `name`, or undefined if none is. */
export function getSimxEditorKeyOfMarker(name: string, registrations: SimxEditorRegistration[]): string | undefined {
    return registrations.find(r => getSimxEditorMarkerName(r.key) === name)?.key;
}

/**
 * Returns the reply to a request the simulator frame of the extension
 * registered under `key` posted to the editor, once the simulator driver has
 * let it through.
 * @param open shows the extension's tab; returns false, showing nothing, if the editor offers no such tab here
 */
export function answerSimxEditorRequest(key: string, msg: unknown, open: (key: string) => boolean): SimxEditorReply {
    const request = msg as { id?: unknown, subtype?: unknown };
    const id = typeof request?.id === "string" ? request.id : undefined;
    if (request?.subtype !== "open")
        return { type: SIMXEDITOR_MESSAGE_TYPE, id, subtype: "error", code: "INVALID_REQUEST", message: `Unknown request ${request?.subtype}.` };
    if (!open(key))
        return { type: SIMXEDITOR_MESSAGE_TYPE, id, subtype: "error", code: "UNAVAILABLE", message: "The editor does not offer this extension's tab here." };
    return { type: SIMXEDITOR_MESSAGE_TYPE, id, subtype: "ack" };
}

/** The parameters the editor passes to a tab frame in its URL, beside `channel` and `role`. */
export interface SimxEditorFrameParams {
    /** The editor's origin, which the frame should trust. */
    parentOrigin: string;
    /** The id of the running target. */
    target?: string;
    /** The id of the open project. */
    project?: string;
    /** The user's language. */
    language?: string;
}

/** What a {@link SimxEditorHost} needs from the editor. */
export interface SimxEditorHostOptions {
    /** Creates an iframe element. */
    createFrame(): HTMLIFrameElement;
    /** Creates an element that shows the editor's loading state. */
    createLoader(): HTMLElement;
    /** Returns the `sandbox` and `allow` values of a simulator frame given a registration's grants. */
    framePermissions(grants: { allowPopups?: boolean, allowClipboardWrite?: boolean, allowDownloads?: boolean }): { sandbox: string, allow: string };
    /** Returns the simulator frame of the extension registered under `key`, creating it if none exists. */
    startSimulatorExtension(key: string): HTMLIFrameElement | undefined;
    /** Returns the simulator's state now. */
    getSimulatorState(): SimxEditorSimulatorState;
    /** Creates the channel the host brokers between two frames. */
    createChannel(): MessageChannel;
}

/** A tab frame, with what the host knows of it. */
interface SimxEditorTab {
    key: string;
    frame: HTMLIFrameElement;
    // the origin of the tab's page, which its messages come from and the host posts to
    origin: string;
    // the project the frame was created for
    project: string | undefined;
    // true once the tab has posted the ready event
    ready: boolean;
}

/**
 * Hosts the editor tab frames of simulator extensions in one container element:
 * creates each on first use, shows one at a time, posts their lifecycle and
 * simulator events, and brokers a `MessageChannel` between each ready tab frame
 * and the loaded simulator frame of the same key. Shows its loading state over
 * the shown tab until that tab is ready.
 */
export class SimxEditorHost {
    protected tabs: pxt.Map<SimxEditorTab> = {};
    // per key: the simulator frame that last finished loading
    protected simulatorFrames: pxt.Map<HTMLIFrameElement> = {};
    // the key of the shown tab, or undefined while none is shown
    protected shownKey: string | undefined;
    // the key of the tab shown last, until forgotten or its frame is removed
    protected lastShownKey: string | undefined;
    protected container: HTMLElement | undefined;
    protected loader: HTMLElement | undefined;

    constructor(protected readonly options: SimxEditorHostOptions) {
    }

    /** Returns the tab frame of `key`, or undefined if there is none. */
    getFrame(key: string): HTMLIFrameElement | undefined {
        return this.tabs[key]?.frame;
    }

    /** Returns true if the tab of `key` has posted the ready event. */
    isReady(key: string): boolean {
        return !!this.tabs[key]?.ready;
    }

    /**
     * Shows the tab of `registration`, hiding any other, creating its frame in
     * `container` if it has none, and starting the simulator frame of the same
     * key if none exists. Posts `hidden` to the tab hidden and `shown` to the tab
     * shown, if they are ready.
     */
    show(registration: SimxEditorRegistration, container: HTMLElement, params: SimxEditorFrameParams) {
        if (!this.tabs[registration.key]) this.createTab(registration, container, params);
        this.setShown(registration.key);
    }

    /** Hides the shown tab, if any, posting it `hidden` if it is ready. */
    hide() {
        this.setShown(undefined);
    }

    // PR NOTE [Issue 6] -- lift into the PR description, then remove.
    // The editor toggle keeps showing the tab shown last while Blocks is
    // active, as it keeps showing Python, the text language chosen last. The
    // language choice is a user-level preference, saved across projects; a
    // tab belongs to its project and lives only for the project's session,
    // so the host remembers it beside the tab frames: from when the tab is
    // shown until a text language is shown (see forgetLastShown) or the
    // tab's frame is removed with its project (see close).
    /**
     * Returns the key of the tab shown last, kept while the tab is hidden;
     * undefined if no tab was shown since `forgetLastShown`, or that tab's
     * frame was removed.
     */
    getLastShownKey(): string | undefined {
        return this.lastShownKey;
    }

    /** Forgets the tab shown last, as the editor does when it shows a text language. */
    forgetLastShown() {
        this.lastShownKey = undefined;
    }

    // PR NOTE [Issue 6] -- lift into the PR description, then remove.
    // Opening a tab moves focus into it, as opening JavaScript or Python
    // focuses the text editor; that focus leaving the language dropdown is
    // what closes the dropdown after an entry is chosen.
    /** Moves focus into the shown tab's frame; does nothing while no tab is shown. */
    focus() {
        if (this.shownKey) this.tabs[this.shownKey]?.frame.focus();
    }

    protected setShown(key: string | undefined) {
        const previous = this.shownKey;
        this.shownKey = key;
        if (key) this.lastShownKey = key;
        for (const k of Object.keys(this.tabs)) {
            this.tabs[k].frame.style.display = k === key ? "" : "none";
        }
        if (previous !== key) {
            if (previous) this.post(previous, { type: SIMXEDITOR_MESSAGE_TYPE, event: "hidden" });
            if (key) this.post(key, { type: SIMXEDITOR_MESSAGE_TYPE, event: "shown" });
        }
        this.updateLoader();
    }

    protected createTab(registration: SimxEditorRegistration, container: HTMLElement, params: SimxEditorFrameParams) {
        const key = registration.key;
        const url = new URL(registration.url);
        url.searchParams.set("parentOrigin", params.parentOrigin);
        url.searchParams.set("channel", key);
        url.searchParams.set("role", SIMXEDITOR_ROLE);
        if (params.language) url.searchParams.set("language", params.language);
        if (params.target) url.searchParams.set("target", params.target);
        if (params.project) url.searchParams.set("project", params.project);

        const frame = this.options.createFrame();
        const permissions = this.options.framePermissions(registration);
        frame.setAttribute("sandbox", permissions.sandbox);
        frame.setAttribute("allow", permissions.allow);
        frame.allowFullscreen = true;
        frame.title = registration.label;
        frame.className = "simx-editor-frame";
        frame.dataset["simxkey"] = key;
        frame.dataset["simxrole"] = SIMXEDITOR_ROLE;
        frame.dataset["origin"] = url.origin;
        frame.style.display = "none";
        frame.src = url.toString();

        if (this.container !== container) {
            this.container = container;
            this.loader = this.options.createLoader();
            container.appendChild(this.loader);
        }
        container.appendChild(frame);
        this.tabs[key] = { key, frame, origin: url.origin, project: params.project, ready: false };
        // a tab frame never exists without its simulator frame
        this.options.startSimulatorExtension(key);
    }

    /**
     * Handles a message posted to the editor's window: a ready event from a tab
     * frame, accepted only from the frame's window and origin, marks the tab
     * ready, posts it its visibility and the simulator's state, and brokers its
     * port if its simulator frame is loaded. Other messages are ignored.
     */
    handleMessage(ev: { data: any, source: unknown, origin: string }) {
        if (ev?.data?.type !== SIMXEDITOR_MESSAGE_TYPE || ev.data.event !== "ready") return;
        const tab = Object.keys(this.tabs).map(k => this.tabs[k])
            .find(t => !!ev.source && t.frame.contentWindow === ev.source && t.origin === ev.origin);
        if (!tab) return;
        tab.ready = true;
        this.post(tab.key, { type: SIMXEDITOR_MESSAGE_TYPE, event: tab.key === this.shownKey ? "shown" : "hidden" });
        this.post(tab.key, { type: SIMXEDITOR_MESSAGE_TYPE, event: "simulatorstate", state: this.options.getSimulatorState() });
        this.broker(tab.key);
        this.updateLoader();
    }

    /**
     * Records that the simulator frame of `key` finished loading a page, and
     * brokers a port between it and the tab of `key`, if that tab is ready.
     */
    simulatorFrameLoaded(key: string, frame: HTMLIFrameElement) {
        this.simulatorFrames[key] = frame;
        this.broker(key);
    }

    /** Posts `command` to every ready tab, as the editor gives it to the simulator. */
    simulatorCommand(command: SimxEditorSimulatorCommand) {
        for (const key of Object.keys(this.tabs)) {
            this.post(key, { type: SIMXEDITOR_MESSAGE_TYPE, event: "simulator", command });
        }
    }

    /** Posts the simulator's new state to every ready tab. */
    simulatorStateChanged(state: SimxEditorSimulatorState) {
        for (const key of Object.keys(this.tabs)) {
            this.post(key, { type: SIMXEDITOR_MESSAGE_TYPE, event: "simulatorstate", state });
        }
    }

    /**
     * Removes every tab frame not created for `project`, or every tab frame if
     * `project` is undefined, posting each ready one `closing` first, and
     * forgets the tab shown last if its frame is removed.
     */
    close(project?: string) {
        for (const key of Object.keys(this.tabs)) {
            const tab = this.tabs[key];
            if (project !== undefined && tab.project === project) continue;
            this.post(key, { type: SIMXEDITOR_MESSAGE_TYPE, event: "closing" });
            tab.frame.parentElement?.removeChild(tab.frame);
            delete this.tabs[key];
            if (this.shownKey === key) this.shownKey = undefined;
            if (this.lastShownKey === key) this.lastShownKey = undefined;
        }
        this.updateLoader();
    }

    // creates a MessageChannel and posts one end to the tab of `key` and the other
    // to the simulator frame of `key`, if the tab is ready and that frame is loaded
    // and still in the page
    protected broker(key: string) {
        const tab = this.tabs[key];
        const simulatorFrame = this.simulatorFrames[key];
        if (!tab?.ready || !tab.frame.contentWindow) return;
        if (!simulatorFrame?.isConnected || !simulatorFrame.contentWindow) return;
        const channel = this.options.createChannel();
        const msg: SimxEditorPortMessage = { type: SIMXEDITOR_PORT_MESSAGE_TYPE, key };
        simulatorFrame.contentWindow.postMessage(msg, new URL(simulatorFrame.src).origin, [channel.port1]);
        tab.frame.contentWindow.postMessage(msg, tab.origin, [channel.port2]);
    }

    protected post(key: string, msg: SimxEditorEvent) {
        const tab = this.tabs[key];
        if (tab?.ready && tab.frame.contentWindow)
            tab.frame.contentWindow.postMessage(msg, tab.origin);
    }

    protected updateLoader() {
        if (!this.loader) return;
        const loading = !!this.shownKey && !this.tabs[this.shownKey]?.ready;
        this.loader.style.display = loading ? "" : "none";
    }
}
