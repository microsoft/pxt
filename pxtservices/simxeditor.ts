/**
 * The editor-tab ("simxeditor") messages a simulator extension exchanges with
 * the editor. The editor serves them only to simulator extensions whose
 * registration declares an `editor` and sets `allowEditorTab`.
 *
 * Such an extension has two frames, both created for its key: its simulator
 * frame, in the simulator column, and its tab frame, in the editor area. The
 * tab frame's URL carries the simulator frame's parameters (`parentOrigin`,
 * `channel`, `apiLevel`, `target`, `project`, `language`) and `role=editor`; the
 * simulator frame's URL carries `editor=1`. The tab frame is not a simulator
 * frame: it receives no simulator messages and its messages never reach the
 * simulator. The two frames talk over a `MessagePort` pair the editor
 * brokers, and the editor never reads that channel.
 *
 * A tab lives for one load of its project: the editor removes the tab frame
 * when the project closes or reloads, and the ports and project-asset
 * subscriptions the tab held end with it. The editor posts no message before
 * removing the frame; to save state, listen for `pagehide` on the tab's window.
 *
 * This module has no dependencies; a simulator extension can import or copy it
 * as-is.
 */

/** The `type` of every simxeditor event, request and reply. */
export const SIMXEDITOR_MESSAGE_TYPE = "simxeditor";

/** The `type` of the message that carries a brokered port. */
export const SIMXEDITOR_PORT_MESSAGE_TYPE = "simxeditorport";

/** The value of the tab frame's `role` URL parameter. */
export const SIMXEDITOR_ROLE = "editor";

/**
 * Returns the origin of the editor hosting this simulator extension's frame,
 * e.g. `https://arcade.makecode.com`, which the editor passes in the frame
 * URL's `parentOrigin` parameter. Post the ready event and requests to it.
 * @param search the frame URL's query string; defaults to `window.location.search`
 * @returns the origin, or undefined if the URL provides none
 */
export function getParentOrigin(search?: string): string | undefined {
    const query = search !== undefined ? search : window.location.search;
    return new URLSearchParams(query).get("parentOrigin") || undefined;
}

/**
 * Returns true if the editor offers this simulator extension's tab to the open
 * project, which the editor tells its simulator frame with the `editor=1` URL
 * parameter: the registration declares and enables a tab, and the project
 * includes the extension. A true result does not guarantee an open request
 * succeeds: in a view that shows no extension tabs, it is answered with
 * `UNAVAILABLE`.
 * @param search the frame URL's query string; defaults to `window.location.search`
 */
export function hasEditorTab(search?: string): boolean {
    const query = search !== undefined ? search : window.location.search;
    return new URLSearchParams(query).get("editor") === "1";
}

/**
 * Returns the level of the simulator-extension APIs the editor hosting this
 * frame serves, which the editor passes in the frame URL's `apiLevel`
 * parameter. Level 1 is the `projfs`, `projassets` and `simxeditor` messages
 * and the registration fields; each later level adds to or alters them. Read
 * it at startup to learn whether the editor answers a request before sending it.
 * @param search the frame URL's query string; defaults to `window.location.search`
 * @returns the level; 0, the level of an editor older than level 1, if the URL
 * provides none or one that is not a non-negative integer
 */
export function getSimxApiLevel(search?: string): number {
    const query = search !== undefined ? search : window.location.search;
    const value = new URLSearchParams(query).get("apiLevel");
    return value !== null && /^[0-9]+$/.test(value) ? Number(value) : 0;
}

/** Posted by the tab frame to its parent once it listens for messages. */
export interface SimxEditorReadyEvent {
    type: typeof SIMXEDITOR_MESSAGE_TYPE;
    event: "ready";
}

/**
 * Posted to the tab frame when the tab is shown or hidden: on every switch
 * into or out of it, and once after the tab is ready. A hidden tab frame stays
 * loaded, but the browser may not render it or run its timers on time.
 */
export interface SimxEditorVisibilityEvent {
    type: typeof SIMXEDITOR_MESSAGE_TYPE;
    event: "shown" | "hidden";
}

/** A command the editor gives the simulator. */
export type SimxEditorSimulatorCommand = "start" | "stop" | "restart";

/**
 * Posted to the tab frame as the editor gives the simulator a command: `start`
 * on every run that reaches the simulator, `stop` when it stops the simulator,
 * and `restart` when it restarts the program already in the simulator.
 */
export interface SimxEditorSimulatorEvent {
    type: typeof SIMXEDITOR_MESSAGE_TYPE;
    event: "simulator";
    command: SimxEditorSimulatorCommand;
}

/** The states of the simulator, by the names of the simulator driver's `SimulatorState`. */
export type SimxEditorSimulatorState = "Unloaded" | "Stopped" | "Pending" | "Starting" | "Running" | "Paused" | "Suspended";

/** Posted to the tab frame when the simulator's state changes, and once after the tab is ready. */
export interface SimxEditorSimulatorStateEvent {
    type: typeof SIMXEDITOR_MESSAGE_TYPE;
    event: "simulatorstate";
    state: SimxEditorSimulatorState;
}

/**
 * Posted to the tab frame when the editor enters or leaves fullscreen-simulator
 * mode, in which the simulator covers the editor area and the tab, and once
 * after the tab is ready.
 */
export interface SimxEditorFullscreenEvent {
    type: typeof SIMXEDITOR_MESSAGE_TYPE;
    event: "fullscreen";
    /** True while the editor is in fullscreen-simulator mode. */
    enabled: boolean;
}

/**
 * Posted to the tab frame when the user asks, outside the tab, for an action
 * the tab carries out, which the editor also shows the tab for. `create` asks
 * the tab to create an instance of the fixed-instance type `qName`, one of
 * those its registration's `editor.creates` names, as when the user picks the
 * last entry of a block dropdown listing that type's instances. Posted once the
 * tab is ready: at once if it is, else after the events that follow its ready
 * event. A request made before an earlier one was posted replaces it, and a
 * request not yet posted is dropped when the tab frame is removed.
 */
export interface SimxEditorActionEvent {
    type: typeof SIMXEDITOR_MESSAGE_TYPE;
    event: "action";
    action: "create";
    /** The fully qualified name of the type, e.g. `myext.Widget`. */
    qName: string;
}

/** A message the editor posts to the tab frame. */
export type SimxEditorEvent =
    SimxEditorVisibilityEvent
    | SimxEditorSimulatorEvent
    | SimxEditorSimulatorStateEvent
    | SimxEditorFullscreenEvent
    | SimxEditorActionEvent;

/**
 * Posted to the tab frame and to the simulator frame of the same key, each
 * with one end of a new `MessageChannel` in the event's `ports[0]`. The editor
 * posts a new pair whenever both frames exist and the tab is ready: when the
 * tab becomes ready while the simulator frame is loaded, and whenever a
 * simulator frame finishes loading while the tab is ready. If the simulator
 * frame does not exist, the editor creates it each time it shows the tab and
 * after the simulator unloads while the tab exists, and a new pair follows
 * once it loads. Either side may close its port; a new pair replaces it.
 */
export interface SimxEditorPortMessage {
    type: typeof SIMXEDITOR_PORT_MESSAGE_TYPE;
    /** The extension's key, e.g. `owner/repo`. */
    key: string;
}

/**
 * Posted by the simulator frame to its parent to ask the editor to show the
 * tab. The editor shows it, creating the tab frame if needed, and replies once,
 * to the simulator frame, with the request's `id`.
 */
export interface SimxEditorOpenRequest {
    type: typeof SIMXEDITOR_MESSAGE_TYPE;
    subtype: "open";
    id: string;
}

/**
 * Why an open request failed. Clients branch on the code; the message that
 * accompanies it is for people.
 */
export type SimxEditorErrorCode =
    /** The requesting frame is not the simulator frame of an extension registered for, and included in, the open project. */
    "UNREGISTERED"
    /** The extension's registration does not declare and enable an editor tab. */
    | "PERMISSION_DENIED"
    /** The editor shows no extension tabs in its current view, such as an embedded, read-only or tutorial view. */
    | "UNAVAILABLE"
    /** The request is not one the editor knows, or the editor failed to carry it out. */
    | "INVALID_REQUEST";

/** The reply to an open request the editor carried out. */
export interface SimxEditorAckReply {
    type: typeof SIMXEDITOR_MESSAGE_TYPE;
    id: string;
    subtype: "ack";
}

/** The reply to a request the editor refused. */
export interface SimxEditorErrorReply {
    type: typeof SIMXEDITOR_MESSAGE_TYPE;
    id: string | undefined;
    subtype: "error";
    code: SimxEditorErrorCode;
    message: string;
}

/** A reply the editor posts to the simulator frame. */
export type SimxEditorReply = SimxEditorAckReply | SimxEditorErrorReply;
