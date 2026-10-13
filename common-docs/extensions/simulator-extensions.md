# Simulator Extensions

A simulator extension is a static web application that complements a traditional MakeCode extension. When you add an extension containing a simulator extension to your MakeCode project, the simulator extension is loaded into a separate iframe within the MakeCode editor. This enables extensions to display custom UI when the project is running.

> [!IMPORTANT]
> Simulator extensions are only supported for [Approved Extensions](./approval.md), and they must go through an additional approval process. The MakeCode team reserves the right to approve or decline simulator extensions at their discretion. We strongly recommend consulting with the MakeCode team before investing time and resources into creating a simulator extension.

## Example simulator extensions

* [pxt-simx-sample](https://github.com/microsoft/pxt-simx-sample)
* [pxt-arcadeshield](https://github.com/microsoft/pxt-arcadeshield)
* [microbit-robot](https://github.com/microsoft/microbit-robot)
* [pxt-jacdac](https://github.com/microsoft/)

## Creating a simulator extension

Refer to the [pxt-simx-sample](https://github.com/microsoft/pxt-simx-sample) project for detailed instructions.


## Resizing the simulator extension frame

A simulator extension frame is as wide as the simulator column, and its height follows the `aspectRatio` of its registration. The frame can change its aspect ratio at run time by posting `{ type: "aspectratio", value, frameid }` to its parent, where `value` is the new width-to-height ratio and `frameid` is the frame's id, which the editor passes in the hash of the frame's URL.

## Fullscreen simulator

The editor posts `{ type: "fullscreen", enabled }` to every simulator frame when the editor enters or leaves fullscreen-simulator mode, where `enabled` is `true` while the simulator fills the editor. A simulator extension frame whose page finishes loading while the mode is on receives the message once loaded, so a frame that appears during fullscreen knows it. Until a frame receives a `fullscreen` message, the editor is not in fullscreen-simulator mode.

## Editor tab

A simulator extension can also contribute an editor tab: a page of the extension that the editor shows in the editor area, beside Blocks and the text editors, while the simulator stays visible. The editor lists the tab in the language dropdown of the editor toggle, after JavaScript and Python. The tab is offered only while the open project includes the extension, and never in embedded (sandbox) views, where the Assets editor is not offered either.

The editor toolbar stays below the tab, as it does below Blocks and the text editors, without its undo, redo and zoom controls, which the tab does not have: the simulator can be collapsed and expanded, and the project downloaded, while the tab is shown.

### Registration

The tab is declared in the extension's `simx` entry in the target's `targetconfig.json` (`packages.approvedRepoLib`), beside its other settings:

```json
"simx": {
    "index": "simx/index.html",
    "editor": {
        "index": "index.html",
        "label": "My Extension",
        "icon": "brand/icon.svg"
    },
    "allowEditorTab": true
}
```

* `editor.index` is the tab's page, a path within the extension's published files, resolved the same way as `index`.
* `editor.label` names the tab in the toggle and is its accessible name. It is shown as text, as the names of Blocks, JavaScript and Python are. It is not localized.
* `editor.icon` is an optional icon shown on the label's left. It is either the class names of one of MakeCode's font icons, as its own editors use (for example `xicon js`), or the path to an SVG within the extension's published files, resolved the same way as `index`. A value that contains a `/` or ends in `.svg` is a path; any other value is class names.
* An SVG icon is drawn as a mask in the toggle's text color: only its shape is used, so it follows the editor's color themes, high contrast included. A square SVG drawn in a single color, such as `currentColor`, is recommended.
* `allowEditorTab` enables the tab. The editor offers no tab unless the registration sets both `editor` and `allowEditorTab`.
* A registration with an editor tab must be `permanent` (the default); the editor ignores, and logs, an `editor` on a registration with `permanent: false`.

The editor selects the tab through a session-only marker file named after the extension's key (`owner~repo.simxeditor`), which it creates the first time the tab is opened in a session. The marker is never saved, listed with the project's files, shared or exported, so the project itself does not change. File names ending in `.simxeditor` are reserved for these markers.

### Two frames

An extension with an editor tab has two frames, both created for its key:

* Its **simulator frame**, in the simulator column, is the extension's simulator frame as before. Its URL also carries `editor=1`, so the frame knows at startup that the tab exists. It receives the run message and every simulator message, and it may post simulator messages.
* Its **tab frame**, in the editor area, is created the first time the tab is opened and removed only when the project closes. Its URL carries the same parameters as the simulator frame's (`parentOrigin`, `channel`, `target`, `project`, `language`) plus `role=editor`, and it gets the same sandbox and permissions under the same grants. It is not a simulator frame: it receives no simulator messages, and nothing it posts reaches the simulator.

When the editor opens a tab and the extension's simulator frame does not exist (for example, because the program has not run), the editor creates it.

### Ready, and the port

The editor shows its loading indicator over the tab until the tab frame posts `{ type: "simxeditor", event: "ready" }` to its parent. Post it once the page listens for messages.

Once the tab is ready and the simulator frame has loaded, the editor creates a `MessageChannel` and posts `{ type: "simxeditorport", key }` to each frame, with one of the channel's ports in the event's `ports[0]`. The two frames talk over that channel; the editor never reads it. The editor brokers a new pair whenever a new simulator frame of the extension loads (after the simulator is collapsed and expanded, or the project reloads), so both frames should accept a new port at any time. Either side may close its port.

### Lifecycle events

The editor posts these messages to the tab frame:

* `{ type: "simxeditor", event: "shown" }` and `{ type: "simxeditor", event: "hidden" }` when the user switches to or away from the tab, and once after the tab is ready.
* `{ type: "simxeditor", event: "closing" }` before the editor removes the tab frame, when the project closes.
* `{ type: "simxeditor", event: "simulator", command }` as the editor starts, stops or restarts the simulator, where `command` is `"start"` (on every run, including the automatic reruns after an edit), `"stop"` or `"restart"`. The event carries no program; the simulator frame receives the run message and can share it over the port.
* `{ type: "simxeditor", event: "simulatorstate", state }` when the simulator's state changes, and once after the tab is ready, where `state` is one of `"Unloaded"`, `"Stopped"`, `"Pending"`, `"Starting"`, `"Running"`, `"Paused"` and `"Suspended"`.
* `{ type: "simxeditor", event: "fullscreen", enabled }` when the editor enters or leaves fullscreen-simulator mode, and once after the tab is ready, where `enabled` is `true` while the simulator covers the editor area, and with it the tab. The simulator frame receives the `fullscreen` message at the same time, so an extension whose tab is its main view can show that view in the simulator frame while the tab is covered.

A hidden tab stays loaded, but it is not rendered, and the browser may run its timers late or not at all. Render only while the tab is shown, and keep any computation that must not pause, such as a simulation, in the simulator frame, which is visible whenever the simulator is. A tab that runs simulators of its own is responsible for them while it is hidden, for example by pausing them.

### Grants

The extension's grants apply to both of its frames: the tab frame may send project-file (`projfs`) requests under `allowFileWrite` and project-asset (`projassets`) requests under `allowAssetRead`, just as the simulator frame may. Both frames share one folder and one queue: the editor applies the requests of both frames in the order it receives them, under one rate limit and one size quota, and replies to the frame that sent each request. Each frame that subscribes to project-asset changes is notified.

### Opening the tab from the simulator frame

The simulator frame may ask the editor to show the tab, for example when the user clicks a button in it, by posting `{ type: "simxeditor", subtype: "open", id }` to its parent. The editor shows the tab, creating the tab frame if needed, and replies to the simulator frame with `{ type: "simxeditor", id, subtype: "ack" }`, or with `{ type: "simxeditor", id, subtype: "error", code, message }`, where `code` is `UNREGISTERED` (the frame is not a registered simulator extension frame), `PERMISSION_DENIED` (the registration does not declare and enable a tab), `UNAVAILABLE` (the editor offers no tab here) or `INVALID_REQUEST`.

The message types are defined in `pxtservices/simxeditor.ts`, which has no dependencies and can be copied into an extension.
