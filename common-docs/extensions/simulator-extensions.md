# Simulator Extensions

A simulator extension is a static web application that complements a traditional MakeCode extension. When you add an extension containing a simulator extension to your MakeCode project, the simulator extension is loaded into a separate iframe within the MakeCode editor. This enables extensions to display custom UI when the project is running. A simulator extension can also read and write files in the project, read the project's assets, and contribute an editor tab beside Blocks and the text editors.

> [!IMPORTANT]
> Simulator extensions are only supported for [Approved Extensions](./approval.md), and they must go through an additional approval process. The MakeCode team reserves the right to approve or decline simulator extensions at their discretion. We strongly recommend consulting with the MakeCode team before investing time and resources into creating a simulator extension.

## Example simulator extensions

* [pxt-simx-sample](https://github.com/microsoft/pxt-simx-sample)
* [pxt-arcadeshield](https://github.com/microsoft/pxt-arcadeshield)
* [microbit-robot](https://github.com/microsoft/microbit-robot)
* [pxt-jacdac](https://github.com/microsoft/)

## Creating a simulator extension

Refer to the [pxt-simx-sample](https://github.com/microsoft/pxt-simx-sample) project for detailed instructions.

## Registration

A simulator extension is registered in the `simx` entry of its repository in the target's `targetconfig.json` (`packages.approvedRepoLib`), under the extension's key, such as `owner/repo`:

```json
"approvedRepoLib": {
    "owner/repo": {
        "simx": {
            "sha": "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
            "index": "simx/index.html",
            "allowFileWrite": true
        }
    }
}
```

The fields of the `simx` entry:

| Field | What it does | Default | Frames |
| --- | --- | --- | --- |
| `sha` | The commit of the extension's repository whose published files the frames load. Required. | none | both |
| `repo` | The repository the published files are loaded from. | the key | both |
| `ref` | The branch of `repo` that is synced. | `gh-pages` | both |
| `devUrl` | The URL the frames load the extension from, instead of its published files, while the editor runs on `localhost` with `simxdev` in its URL. | none | both |
| `index` | The path of the simulator frame's page within the published files. | `index.html` | simulator frame |
| `aspectRatio` | The simulator frame's width-to-height ratio (see [Resizing the simulator extension frame](#resizing-the-simulator-extension-frame)). | the target's simulator aspect ratio, else `1.22` | simulator frame |
| `permanent` | Keeps the simulator frame across runs, restarts and collapses of the simulator; when `false`, the frame is removed some time after the program stops or another run starts. Required by an editor tab. | `true` | simulator frame |
| `allowPopups` | Adds `allow-popups` and `allow-popups-to-escape-sandbox` to the frame's sandbox. | `false` | both |
| `allowClipboardWrite` | Adds `clipboard-write` to the frame's permissions. | `false` | both |
| `allowDownloads` | Adds `allow-downloads` to the frame's sandbox. | `false` | both |
| `allowFileWrite` | Lets the frame list, read, write and delete files in its folder of the project (see [Project files](#project-files)). | `false` | both |
| `allowAssetRead` | Lets the frame list the project's assets, name, palette and simulator theme, and hear when they change (see [Project assets](#project-assets)). | `false` | both |
| `allowEditorTab` | Enables the editor tab that `editor` declares (see [Editor tab](#editor-tab)). | `false` | tab frame, and the simulator frame's request to open it |
| `editor` | Declares the extension's editor tab: its page, label and icon. | none | tab frame |
| `hideInFullscreen` | Hides the simulator frame while the editor is in fullscreen-simulator mode; it stays loaded and keeps messaging. | `false` | simulator frame |

The frame's page receives these parameters in its URL: `parentOrigin` (the editor's origin), `channel` (the extension's key), `language` (the user's language), `target` (the target's id) and `project` (the open project's id, when one is open). `target` and `project` are informational: they grant and select nothing.

### Grants

The grants (`allowPopups`, `allowClipboardWrite`, `allowDownloads`, `allowFileWrite`, `allowAssetRead` and `allowEditorTab`) are approved by the target's owner together with the registration. They hold among the target's approved extensions, not against each other: every simulator extension frame, every tab frame and the main simulator are served from the simulator's one origin, so an extension's frames can reach the frames of another extension, and a request posted from another extension's window is served under that extension's grants.

Whatever the grants, every simulator frame and tab frame may go fullscreen (`allowfullscreen`) and has the `autoplay` and `microphone` permissions of the main simulator frame; no grant controls them.

`allowFileWrite` also lets the extension change the user's program: every file it writes into its folder is listed in the project's `pxt.json`, so a `.ts` or `.py` file it writes is compiled with the program, and a `.jres` file adds to the project's assets.

`allowAssetRead` discloses the project's name beside its assets, palette and simulator theme.

A frame should accept a reply, an event or a port only from `window.parent`, and only when the event's origin is the `parentOrigin` its URL carries.

## Resizing the simulator extension frame

A simulator extension frame is as wide as the simulator column, and its height follows the `aspectRatio` of its registration. The frame can change its aspect ratio at run time by posting `{ type: "aspectratio", value, frameid }` to its parent, where `value` is the new width-to-height ratio and `frameid` is the frame's id, which the editor passes in the hash of the frame's URL.

## Fullscreen simulator

An extension has two ways to handle fullscreen-simulator mode, in which the simulator fills the editor: listen for the `fullscreen` message and adapt, or set `hideInFullscreen` in its registration to be hidden while the mode is on.

The editor posts `{ type: "fullscreen", enabled }` to every simulator frame when the editor enters or leaves fullscreen-simulator mode, where `enabled` is `true` while the simulator fills the editor. A simulator extension frame whose page finishes loading while the mode is on receives the message once loaded, so a frame that appears during fullscreen knows it. Until a frame receives a `fullscreen` message, the editor is not in fullscreen-simulator mode.

A frame registered with `hideInFullscreen` is hidden while the mode is on, and the main simulator takes the full width beside it. It stays loaded, receives every message, `fullscreen` included, and may keep posting.

## Project files

An extension registered with `allowFileWrite` can list, read, write and delete files in the project by posting `projfs` requests to its parent. The editor replies once to each request from one of the extension's frames, to that frame only, with the request's `id`; it drops requests from other windows, and from origins it does not serve.

| Request | Reply |
| --- | --- |
| `{ type: "projfs", id, subtype: "list" }` | `{ type: "projfs", id, subtype: "files", files }`, where each of `files` is `{ name, size }`, `size` being the file's size in UTF-8 bytes |
| `{ type: "projfs", id, subtype: "read", name }` | `{ type: "projfs", id, subtype: "content", name, content }` |
| `{ type: "projfs", id, subtype: "write", name, content, dirty }` | `{ type: "projfs", id, subtype: "ack", name }` |
| `{ type: "projfs", id, subtype: "delete", name, dirty }` | `{ type: "projfs", id, subtype: "ack", name }` |

A refused request is answered with `{ type: "projfs", id, subtype: "error", code, message }`, where `code` is one of the [error codes](#error-codes) and `message` is for people.

`content` is text, or binary data as a `data:<mime type>;base64,` URI. By default, a write or delete is an artifact: it is saved with the project, and the text editor showing a written file shows the new content, but a running simulator keeps its code until the program next runs. With `dirty: true`, it is a user edit: the editor showing the file shows the new content, the project is typechecked, and the simulator reruns if it runs automatically, just as after the user types. Either way, a write to the file open in the text editor reloads it there, which replaces any change not yet saved from it and resets its undo history and cursor.

### The extension's folder

An extension's folder is the folder of its GitHub repository, `owner/repo/`, whatever subfolder its key names: every registration of the repository, and both frames of each, share the folder. Requests and replies name files relative to it; a file named `notes.txt` is `owner/repo/notes.txt` in the project. Within the folder, `list` and `read` see only the files the project's `pxt.json` lists; a write lists its file, and a delete removes the file from the project and from `pxt.json`.

### Names

* A name is relative: it has no empty, `.` or `..` segment, and `/` and `\` both separate segments.
* A name ending in `.simxeditor` is refused in every request; the suffix is reserved for the editor.
* A write follows the file explorer's rule for a new file: its name starts with a letter, digit or underscore and uses only letters, digits, `_`, `-`, `.` and `/`. A write also refuses a name whose last segment is `pxt.json`, in any letter case, at any depth.
* A stored file whose name does not follow the rules for writes can still be read and deleted.

### Limits

The limits are defined in `webapp/src/projfsHost.ts`:

* `PROJFS_FOLDER_QUOTA_BYTES` (512 KiB): the most the files in a folder may hold, counting the UTF-8 bytes of each file's content and of its name relative to the folder, listed or not. A write that leaves the folder no larger than it was is accepted even while the folder is over the quota.
* `PROJFS_MAX_FOLDER_FILES` (256): the most files a folder may store.
* `PROJFS_MAX_NAME_LENGTH` (128) and `PROJFS_MAX_NAME_SEGMENTS` (8): the most characters, and `/`-separated segments, of a name a write gives a file.
* `PROJFS_RATE_LIMIT` (30) within `PROJFS_RATE_WINDOW_MS` (10 seconds): the most writes and deletes on a folder applied within any such window. Later ones are deferred, not refused: they wait, with the requests behind them, until the window allows them.
* `PROJFS_MAX_PENDING_REQUESTS` (1000): the most requests on a folder that may wait for replies; more are refused with `RATE_LIMITED`.

### Ordering

The editor keeps one queue per folder: it applies a folder's requests one at a time, in the order they arrive, and sends their replies in that order. A request applies to the project open when it arrived, once that project has loaded.

### Error codes

* `NOT_FOUND`: a read names no file the folder lists, or a delete names a file the folder neither stores nor lists.
* `QUOTA_EXCEEDED`: the write would take the folder over its size or file limit, or its content alone is larger than the folder may hold. Nothing was written.
* `INVALID_NAME`: the name breaks the [name rules](#names).
* `RATE_LIMITED`: the folder already had as many requests waiting for replies as the editor holds; the request was not applied.
* `INVALID_REQUEST`: the request is malformed.
* `PROJECT_CLOSED`: no project was open when the request arrived, or that project failed to load or has since closed; a later request may succeed.
* `UNREGISTERED`: the requesting frame is not a frame of a registered extension the open project includes, or it posted from an origin other than the one its frame was created with.
* `PERMISSION_DENIED`: the registration does not set `allowFileWrite`.
* `FAILED`: the editor met an error applying the request. A write or delete may be partly applied; repeating it completes it.

`pxtservices/projfs.ts` defines the messages and a promise-based client, `ProjfsClient`, which also raises `DISPOSED` for a request pending when the client is disposed or made after it. It has no dependencies and can be copied into an extension.

## Project assets

An extension registered with `allowAssetRead` can list the open project's assets, and hear when they change, by posting `projassets` requests to its parent. The editor replies once to each request from one of the extension's frames, to that frame only, with the request's `id`; it drops requests from other windows, and from origins it does not serve.

`{ type: "projassets", id, subtype: "list", kind }` lists the project's own assets of one kind, not those of its extensions. The reply is `{ type: "projassets", id, subtype: "assets", kind, assets, name, palette, theme }`:

* `kind` is the name of one of pxt's asset types that the editor lists: `image` or `song`. A target whose projects hold no assets of a kind lists none. A kind the editor does not list is refused with `UNSUPPORTED_KIND`.
* Each `image` is `{ kind, id, displayName, width, height, data }`: `id` is the key of the image in the project's asset file, which stays the same when the image is renamed; `displayName` is the name the user gave it, absent if it has none; `width` and `height` are in pixels; and `data` is its pixels in pxt's image encoding (`image/x-mkcd-f4`), base64-encoded.
* Each `song` is `{ kind, id, displayName }`, named the same way.
* `name` is the project's name.
* `palette` is the project's palette, the project's own if its `pxt.json` sets one, else the target's: an array of `#rrggbb` colors, which a pixel value indexes.
* `theme` is the simulator theme the project shows, mapping each token to its value; it is absent if the target offers no simulator themes.

The editor answers the list requests of the extensions of one repository in the order they arrive, at most `PROJASSETS_LIST_RATE_LIMIT` (30) within `PROJASSETS_LIST_RATE_WINDOW_MS` (10 seconds), both defined in `webapp/src/projassetsHost.ts`; later ones wait for the window to allow them.

`{ type: "projassets", id, subtype: "subscribe" }` subscribes the requesting frame and is answered with `{ type: "projassets", id, subtype: "ack" }`. The editor then posts `{ type: "projassets", subtype: "changed" }` to the frame when the project's assets, its name or its visual configuration may have changed; several changes in quick succession lead to one notification, and a `list` shows them. A frame holds at most one subscription: subscribing again from the same frame is acknowledged and changes nothing, and each frame of an extension subscribes for itself. Subscribe requests are not limited.

A subscription ends, without notice, when the project closes or reloads. The editor then removes the extension's frames, whose pages hear `pagehide`, and creates new ones as the next load needs them, so a page subscribes once.

A refused request is answered with `{ type: "projassets", id, subtype: "error", code, message }`, where `code` is one of:

* `UNSUPPORTED_KIND`: the editor does not list assets of the requested kind.
* `INVALID_REQUEST`: the request is malformed.
* `PROJECT_CLOSED`: no project was open when the request arrived, or that project failed to load or was replaced before the request was answered; a later request may succeed.
* `UNREGISTERED`: the requesting frame is not a frame of a registered extension the open project includes, or it posted from an origin other than the one its frame was created with.
* `PERMISSION_DENIED`: the registration does not set `allowAssetRead`.
* `FAILED`: the editor met an error answering the request.

`pxtservices/projassets.ts` defines the messages and a promise-based client, `ProjassetsClient`, which also raises `DISPOSED` for a request pending when the client is disposed or made after it. It has no dependencies and can be copied into an extension.

## Editor tab

A simulator extension can also contribute an editor tab: a page of the extension that the editor shows in the editor area, beside Blocks and the text editors, while the simulator stays visible. The editor lists the tab in the language dropdown of the editor toggle, after JavaScript and Python. The tab is offered only while the open project includes the extension from GitHub (a `github:` dependency; an extension added from a file or a local folder gets no tab), and never in views whose editor toggle lists no tabs: embedded (sandbox), read-only (such as the time machine), tutorial and debugging views, and targets that hide the menu bar or show Blocks only.

The editor toolbar stays below the tab, as it does below Blocks and the text editors, without its undo, redo and zoom controls, which the tab does not have: the simulator can be collapsed and expanded, and the project downloaded, while the tab is shown.

### Declaring the tab

The tab is declared in the extension's `simx` entry (see [Registration](#registration)), beside its other settings:

```json
"simx": {
    "sha": "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
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
* `allowEditorTab` enables the tab. The editor offers no tab unless the registration sets both `editor`, with its `index` and `label`, and `allowEditorTab`; it logs a registration that sets `allowEditorTab` without them.
* A registration with an editor tab must be `permanent` (the default); the editor ignores, and logs, an `editor` on a registration with `permanent: false`.

The editor selects the tab through a session-only marker file named after the extension's key (`owner~repo.simxeditor`), which it creates the first time the tab is opened in a session. The marker is never saved, listed with the project's files, shared or exported, so the project itself does not change. File names ending in `.simxeditor` are reserved for these markers.

### Two frames

An extension with an editor tab has two frames, both created for its key:

* Its **simulator frame**, in the simulator column, is the extension's simulator frame as before. Its URL also carries `editor=1` when the open project includes the extension, so the frame knows at startup that the tab exists. It receives the run message and every simulator message, and it may post simulator messages.
* Its **tab frame**, in the editor area, is created the first time the tab is opened and removed when the project closes or reloads. Its URL carries the same parameters as the simulator frame's (`parentOrigin`, `channel`, `target`, `project`, `language`) plus `role=editor`, and it gets the same sandbox and permissions under the same grants. It is not a simulator frame: it receives no simulator messages, and nothing it posts is relayed to the simulator. The editor-wide messages any frame may post, such as `screenshot` and `addextensions`, are handled from it as from a simulator frame.

Whenever the editor shows the tab and the extension's simulator frame does not exist (for example, because the program has not run), the editor creates it. It also creates it again after the simulator unloads while the tab exists, as when the simulator theme picker closes.

### Ready, and the port

The editor shows its loading indicator over the tab until the tab frame posts `{ type: "simxeditor", event: "ready" }` to its parent. Post it once the page listens for messages.

Once the tab is ready and the simulator frame has loaded, the editor creates a `MessageChannel` and posts `{ type: "simxeditorport", key }` to each frame, with one of the channel's ports in the event's `ports[0]`. The two frames talk over that channel; the editor never reads it. The editor brokers a new pair whenever a new simulator frame of the extension loads, as when the editor creates it again after the simulator unloads, so both frames should accept a new port at any time. Either side may close its port.

### Lifecycle events

The editor posts these messages to the tab frame:

* `{ type: "simxeditor", event: "shown" }` and `{ type: "simxeditor", event: "hidden" }` when the user switches to or away from the tab, and once after the tab is ready.
* `{ type: "simxeditor", event: "simulator", command }` as the editor starts, stops or restarts the simulator, where `command` is `"start"` (on every run that reaches the simulator, including the automatic reruns after an edit), `"stop"` or `"restart"` (when the editor restarts the program already in the simulator). The event carries no program; the simulator frame receives the run message and can share it over the port.
* `{ type: "simxeditor", event: "simulatorstate", state }` when the simulator's state changes, and once after the tab is ready, where `state` is one of `"Unloaded"`, `"Stopped"`, `"Pending"`, `"Starting"`, `"Running"`, `"Paused"` and `"Suspended"`.
* `{ type: "simxeditor", event: "fullscreen", enabled }` when the editor enters or leaves fullscreen-simulator mode, and once after the tab is ready, where `enabled` is `true` while the simulator covers the editor area, and with it the tab. The simulator frame receives the `fullscreen` message at the same time, so an extension whose tab is its main view can show that view in the simulator frame while the tab is covered.

A tab lives for one load of its project: the editor removes the tab frame when the project closes or reloads, and the ports and project-asset subscriptions the tab held end with it. The editor posts no message before removing the frame; to save state, listen for `pagehide` on the tab's window.

A hidden tab stays loaded, but it is not rendered, and the browser may run its timers late or not at all. Render only while the tab is shown, and keep any computation that must not pause, such as a simulation, in the simulator frame, which is visible whenever the simulator is. A tab that runs simulators of its own is responsible for them while it is hidden, for example by pausing them.

### Grants of the tab frame

The extension's grants apply to both of its frames: the tab frame may send [project-file](#project-files) requests under `allowFileWrite` and [project-asset](#project-assets) requests under `allowAssetRead`, just as the simulator frame may, in the same folder and under the same limits.

### Opening the tab from the simulator frame

The simulator frame may ask the editor to show the tab, for example when the user clicks a button in it, by posting `{ type: "simxeditor", subtype: "open", id }` to its parent. The editor shows the tab, creating the tab frame if needed, and replies to the simulator frame with `{ type: "simxeditor", id, subtype: "ack" }`, or with `{ type: "simxeditor", id, subtype: "error", code, message }`, where `code` is `UNREGISTERED` (the frame is not the simulator frame of a registered extension the open project includes), `PERMISSION_DENIED` (the registration does not declare and enable a tab), `UNAVAILABLE` (the editor shows no tabs in its current view) or `INVALID_REQUEST` (the request is unknown, or the editor failed to carry it out).

The message types are defined in `pxtservices/simxeditor.ts`, which has no dependencies and can be copied into an extension.
