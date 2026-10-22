/// <reference path="../../built/pxtsim.d.ts" />

import {
    SIMXEDITOR_MESSAGE_TYPE,
    SIMXEDITOR_PORT_MESSAGE_TYPE,
    SIMXEDITOR_ROLE,
    SimxEditorActionEvent,
    SimxEditorEvent,
    SimxEditorPortMessage,
    SimxEditorReply,
    SimxEditorSimulatorCommand,
    SimxEditorSimulatorState,
} from "../../pxtservices/simxeditor";
import { errorReply, getSimxRepository, requestId } from "./simxRequests";

// The editor side of simx editor tabs: the registrations that
// offer a tab to the open project, the tab frames (one per registration,
// created on first selection, hidden across editor switches, removed when the
// project closes or reloads), their lifecycle events, and the MessageChannel
// the editor brokers between a tab frame and the simulator frame of the same key.

/** The fields of a simulator extension registration, as the simulator driver resolved them, that its editor tab uses. */
export interface SimxEditorRegistrationConfig {
    editor?: { label: string; icon?: string };
    editorUrl?: string;
    iconUrl?: string;
    creates?: string[];
    allowPopups?: boolean;
    allowClipboard?: boolean;
    allowCamera?: boolean;
    allowMidi?: boolean;
    allowUsb?: boolean;
    allowSerial?: boolean;
    allowBluetooth?: boolean;
    allowHid?: boolean;
    allowMotionSensors?: boolean;
    allowDisplayCapture?: boolean;
    allowGamepad?: boolean;
    allowDownloads?: boolean;
    allowPointerLock?: boolean;
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
    /** The fully qualified names of the fixed-instance types whose instances the tab creates; undefined if it creates none. */
    creates?: string[];
    /** The tab frame's sandbox gains allow-popups and allow-popups-to-escape-sandbox. */
    allowPopups?: boolean;
    /** The tab frame's allow list gains clipboard-read and clipboard-write. */
    allowClipboard?: boolean;
    /** The tab frame's allow list gains camera. */
    allowCamera?: boolean;
    /** The tab frame's allow list gains midi. */
    allowMidi?: boolean;
    /** The tab frame's allow list gains usb. */
    allowUsb?: boolean;
    /** The tab frame's allow list gains serial. */
    allowSerial?: boolean;
    /** The tab frame's allow list gains bluetooth. */
    allowBluetooth?: boolean;
    /** The tab frame's allow list gains hid. */
    allowHid?: boolean;
    /** The tab frame's allow list gains accelerometer, gyroscope and magnetometer. */
    allowMotionSensors?: boolean;
    /** The tab frame's allow list gains display-capture. */
    allowDisplayCapture?: boolean;
    /** The tab frame's allow list gains gamepad. */
    allowGamepad?: boolean;
    /** The tab frame's sandbox gains allow-downloads. */
    allowDownloads?: boolean;
    /** The tab frame's sandbox gains allow-pointer-lock. */
    allowPointerLock?: boolean;
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
                icon: simx.iconUrl ? undefined : simx.editor.icon,
                iconUrl: simx.iconUrl,
                url: simx.editorUrl,
                creates: simx.creates,
                allowPopups: simx.allowPopups,
                allowClipboard: simx.allowClipboard,
                allowCamera: simx.allowCamera,
                allowMidi: simx.allowMidi,
                allowUsb: simx.allowUsb,
                allowSerial: simx.allowSerial,
                allowBluetooth: simx.allowBluetooth,
                allowHid: simx.allowHid,
                allowMotionSensors: simx.allowMotionSensors,
                allowDisplayCapture: simx.allowDisplayCapture,
                allowGamepad: simx.allowGamepad,
                allowDownloads: simx.allowDownloads,
                allowPointerLock: simx.allowPointerLock,
            };
        });
}

/**
 * Returns true if the project includes the simulator extension registered under
 * `key`: if the GitHub repository `key` names (`owner/repo`, in any case,
 * whatever subfolder `key` adds) is the repository of one of `dependencies`,
 * the version specs of the project's dependencies, direct or not, such as
 * `github:owner/repo/path#ref`. Every registration of one repository is
 * therefore included whenever the project depends on any extension of that
 * repository, and each such registration's tab is offered. A key that names
 * no repository is never included.
 */
export function isSimxInProject(key: string, dependencies: string[]): boolean {
    const slug = getSimxRepository(key);
    if (!slug) return false;
    return dependencies.some(dep => getDependencyRepository(dep)?.toLowerCase() === slug);
}

/**
 * Returns the GitHub repository, `owner/repo`, of the dependency whose version
 * spec is `dependency`, such as `github:owner/repo/path#ref`; undefined if it
 * is not a `github:` spec, or names no repository.
 */
export function getDependencyRepository(dependency: string | undefined): string | undefined {
    if (!/^github:/i.test(dependency || "")) return undefined;
    return pxt.github.parseRepoId(dependency)?.slug;
}

/** Why the editor ignores a registration's claim, in its `creates`, on a type. */
export type SimxCreatesIgnoredReason =
    /** No package of the registration's repository declares the type. */
    "OTHER_REPOSITORY"
    /** A registration earlier in registration order already creates the type's instances. */
    | "CLAIMED_EARLIER";

/** The registration that creates a type's instances, and the claims on the type the editor ignores. */
export interface SimxInstanceCreator {
    /** The registration whose tab creates the type's instances; undefined if none does. */
    creator: SimxEditorRegistration | undefined;
    /** The claims on the type the editor ignores, in registration order. */
    ignored: { key: string, reason: SimxCreatesIgnoredReason }[];
}

/**
 * Returns the registration among `registrations` whose tab creates the
 * instances of the type `typeQName`: the first, in registration order, whose
 * `creates` names the type and whose repository (the `owner/repo` its key
 * names, in any case) is `typeRepository`. Every other registration naming the
 * type is returned among the ignored claims.
 * @param registrations the registrations the project includes, in registration order
 * @param typeRepository the GitHub repository, `owner/repo`, of the package declaring the type; undefined if that package is not from GitHub, as for the project's own code
 */
export function findSimxInstanceCreator(registrations: SimxEditorRegistration[], typeQName: string, typeRepository: string | undefined): SimxInstanceCreator {
    const repository = typeRepository?.toLowerCase();
    const result: SimxInstanceCreator = { creator: undefined, ignored: [] };
    for (const r of registrations) {
        if (!r.creates?.some(type => type === typeQName)) continue;
        if (!repository || getSimxRepository(r.key) !== repository)
            result.ignored.push({ key: r.key, reason: "OTHER_REPOSITORY" });
        else if (result.creator)
            result.ignored.push({ key: r.key, reason: "CLAIMED_EARLIER" });
        else
            result.creator = r;
    }
    return result;
}

/**
 * Returns the registrations among `registrations` whose extension the project
 * includes, as {@link isSimxInProject} decides it.
 * @param dependencies the version specs of the project's dependencies, direct or not
 */
export function getProjectSimxEditors(registrations: SimxEditorRegistration[], dependencies: string[]): SimxEditorRegistration[] {
    return registrations.filter(r => isSimxInProject(r.key, dependencies));
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
    const subtype = (msg as { subtype?: unknown })?.subtype;
    const id = requestId(msg);
    if (subtype !== "open")
        return errorReply(SIMXEDITOR_MESSAGE_TYPE, id, "INVALID_REQUEST", `Unknown request ${subtype}.`);
    if (!open(key))
        return errorReply(SIMXEDITOR_MESSAGE_TYPE, id, "UNAVAILABLE", "The editor does not offer this extension's tab here.");
    return { type: SIMXEDITOR_MESSAGE_TYPE, id, subtype: "ack" };
}

/** The parameters the editor passes to a tab frame in its URL, beside `channel`, `role` and `apiLevel`. */
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
    /** Creates an element that shows the editor's loading state for the tab named `label`. */
    createLoader(label: string): HTMLElement;
    /** Returns the `sandbox` and `allow` values of a simulator frame given a registration's grants. */
    framePermissions(grants: pxsim.SimulatorFrameGrants): { sandbox: string, allow: string };
    /** Returns the simulator frame of the extension registered under `key`, creating it if none exists. */
    startSimulatorExtension(key: string): HTMLIFrameElement | undefined;
    /** Tells the simulator driver that `frame` is the tab frame of the extension registered under `key`. */
    addTabFrame(key: string, frame: HTMLIFrameElement): void;
    /** Tells the simulator driver that `frame`, a tab frame, has been removed. */
    removeTabFrame(frame: HTMLIFrameElement): void;
    /** Returns the simulator's state now. */
    getSimulatorState(): SimxEditorSimulatorState;
    /** Creates the channel the host brokers between two frames. */
    createChannel(): MessageChannel;
}

/** A tab frame, with what the host knows of it. */
interface SimxEditorTab {
    key: string;
    frame: HTMLIFrameElement;
    // the element showing the editor's loading state for the tab, beside its frame
    loader: HTMLElement;
    // the origin of the tab's page, which its messages come from and the host posts to
    origin: string;
    // true once the tab has posted the ready event
    ready: boolean;
}

/**
 * Hosts the editor tab frames of simulator extensions in one container element:
 * creates each on first use, shows one at a time, posts their lifecycle and
 * simulator events, and brokers a `MessageChannel` between each ready tab frame
 * and the loaded simulator frame of the same key. Shows the shown tab's loader,
 * which names the tab, over that tab until it is ready.
 */
export class SimxEditorHost {
    protected tabs: pxt.Map<SimxEditorTab> = {};
    // per key: the simulator frame that last finished loading
    protected simulatorFrames: pxt.Map<HTMLIFrameElement> = {};
    // the key of the shown tab, or undefined while none is shown
    protected shownKey: string | undefined;
    // the key of the tab shown last, until forgotten or its frame is removed
    protected lastShownKey: string | undefined;
    // true while the editor is in fullscreen-simulator mode
    protected fullscreen = false;
    // per key: the action requested of the tab and not yet posted to it
    protected pendingActions: pxt.Map<SimxEditorActionEvent> = {};

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
        this.options.startSimulatorExtension(registration.key);
        this.setShown(registration.key);
    }

    /**
     * Starts the simulator frame of every tab whose simulator frame does not
     * exist, as after the simulator driver removes its frames. A port pair is
     * brokered once each new frame loads.
     */
    ensureSimulatorFrames() {
        for (const key of Object.keys(this.tabs)) {
            this.options.startSimulatorExtension(key);
        }
    }

    /** Hides the shown tab, if any, posting it `hidden` if it is ready. */
    hide() {
        this.setShown(undefined);
    }

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

    /** Moves focus into the shown tab's frame, which closes the language dropdown after a tab is chosen; does nothing while no tab is shown. */
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
        const url = pxsim.simxFrameUrl({ ...params, url: registration.url, key });
        url.searchParams.set("role", SIMXEDITOR_ROLE);

        const frame = this.options.createFrame();
        const permissions = this.options.framePermissions(registration);
        frame.setAttribute("sandbox", permissions.sandbox);
        frame.setAttribute("allow", permissions.allow);
        frame.allowFullscreen = true;
        frame.title = registration.label;
        frame.className = "simx-editor-frame";
        frame.dataset["simxkey"] = key;
        frame.dataset["simxrole"] = SIMXEDITOR_ROLE;
        frame.dataset[pxsim.FRAME_DATA_ORIGIN] = url.origin;
        frame.style.display = "none";
        frame.src = url.toString();

        const loader = this.options.createLoader(registration.label);
        container.appendChild(loader);
        container.appendChild(frame);
        this.tabs[key] = { key, frame, loader, origin: url.origin, ready: false };
        this.options.addTabFrame(key, frame);
    }

    /**
     * Asks the tab of `key` to carry out `action`: posts it at once if the tab
     * is ready, else holds it, in place of any action held for the tab, until
     * the tab's ready event or until the tab frames are removed.
     */
    requestAction(key: string, action: SimxEditorActionEvent) {
        if (this.isReady(key)) this.post(key, action);
        else this.pendingActions[key] = action;
    }

    /**
     * Handles a message posted to the editor's window: a ready event from a tab
     * frame, accepted only from the frame's window and origin, marks the tab
     * ready, posts it its visibility, the simulator's state, whether the editor
     * is in fullscreen-simulator mode and the action held for it, if any, and
     * brokers its port if its simulator frame is loaded. Other messages are
     * ignored.
     */
    handleMessage(ev: { data: any, source: unknown, origin: string }) {
        if (ev?.data?.type !== SIMXEDITOR_MESSAGE_TYPE || ev.data.event !== "ready") return;
        const tab = Object.keys(this.tabs).map(k => this.tabs[k])
            .find(t => !!ev.source && t.frame.contentWindow === ev.source && t.origin === ev.origin);
        if (!tab) return;
        tab.ready = true;
        this.post(tab.key, { type: SIMXEDITOR_MESSAGE_TYPE, event: tab.key === this.shownKey ? "shown" : "hidden" });
        this.post(tab.key, { type: SIMXEDITOR_MESSAGE_TYPE, event: "simulatorstate", state: this.options.getSimulatorState() });
        this.post(tab.key, { type: SIMXEDITOR_MESSAGE_TYPE, event: "fullscreen", enabled: this.fullscreen });
        const action = this.pendingActions[tab.key];
        if (action) {
            delete this.pendingActions[tab.key];
            this.post(tab.key, action);
        }
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
     * Records whether the editor is in fullscreen-simulator mode and, if that
     * changes it, posts the new mode to every ready tab.
     */
    fullscreenChanged(enabled: boolean) {
        if (this.fullscreen === enabled) return;
        this.fullscreen = enabled;
        for (const key of Object.keys(this.tabs)) {
            this.post(key, { type: SIMXEDITOR_MESSAGE_TYPE, event: "fullscreen", enabled });
        }
    }

    /** Removes every tab frame and its loader, drops every action held for a tab, and forgets the shown tab and the tab shown last. */
    close() {
        for (const key of Object.keys(this.tabs)) {
            const { frame, loader } = this.tabs[key];
            loader.parentElement?.removeChild(loader);
            frame.parentElement?.removeChild(frame);
            this.options.removeTabFrame(frame);
        }
        this.tabs = {};
        this.pendingActions = {};
        this.shownKey = undefined;
        this.lastShownKey = undefined;
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
        for (const k of Object.keys(this.tabs)) {
            const tab = this.tabs[k];
            tab.loader.style.display = k === this.shownKey && !tab.ready ? "" : "none";
        }
    }
}
