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
| `aspectRatio` | The simulator frame's width-to-height ratio (see [Resizing](#resizing)). | the target's simulator aspect ratio, else `1.22` | simulator frame |
| `permanent` | Keeps the simulator frame across runs, restarts and collapses of the simulator; when `false`, the frame is removed some time after the program stops or another run starts. Required by an editor tab. | `true` | simulator frame |
| `allowPopups` | Adds `allow-popups` and `allow-popups-to-escape-sandbox` to the frame's sandbox. | `false` | both |
| `allowClipboard` | Adds `clipboard-read` and `clipboard-write` to the frame's permissions. | `false` | both |
| `allowCamera` | Adds `camera` to the frame's permissions. | `false` | both |
| `allowMidi` | Adds `midi` to the frame's permissions. | `false` | both |
| `allowUsb` | Adds `usb` to the frame's permissions. | `false` | both |
| `allowSerial` | Adds `serial` to the frame's permissions. | `false` | both |
| `allowBluetooth` | Adds `bluetooth` to the frame's permissions. | `false` | both |
| `allowHid` | Adds `hid` to the frame's permissions. | `false` | both |
| `allowMotionSensors` | Adds `accelerometer`, `gyroscope` and `magnetometer` to the frame's permissions. | `false` | both |
| `allowDisplayCapture` | Adds `display-capture` to the frame's permissions. | `false` | both |
| `allowGamepad` | Adds `gamepad` to the frame's permissions. | `false` | both |
| `allowDownloads` | Adds `allow-downloads` to the frame's sandbox. | `false` | both |
| `allowPointerLock` | Adds `allow-pointer-lock` to the frame's sandbox. | `false` | both |
| `allowFileWrite` | Lets the frame list, read, write and delete files in its folder of the project (see [Project files](#project-files)). | `false` | both |
| `allowAssetRead` | Lets the frame list the project's assets, name, palette and simulator theme, and hear when they change (see [Project assets](#project-assets)). | `false` | both |
| `allowEditorTab` | Enables the editor tab that `editor` declares (see [Editor tab](#editor-tab)). | `false` | tab frame, and the simulator frame's request to open it |
| `editor` | Declares the extension's editor tab: its page, label (text, or a map by language) and icon, and the types whose instances it creates. | none | tab frame |
| `hideInFullscreen` | Hides the simulator frame while the editor is in fullscreen-simulator mode; it stays loaded and keeps messaging. | `false` | simulator frame |

### Grants and trust

The grants (`allowPopups`, `allowClipboard`, `allowCamera`, `allowMidi`, `allowUsb`, `allowSerial`, `allowBluetooth`, `allowHid`, `allowMotionSensors`, `allowDisplayCapture`, `allowGamepad`, `allowDownloads`, `allowPointerLock`, `allowFileWrite`, `allowAssetRead` and `allowEditorTab`) are approved by the target's owner together with the registration. A grant is given per registration, but grants do not isolate extensions from one another: every simulator extension frame, every tab frame and the main simulator are served from the simulator's one origin, so an extension's frames can reach the frames of another extension, and a request posted from another extension's window is served under that extension's grants. The grants hold among the target's approved extensions, not against each other.

Eight grants deserve a second look:

* `allowFileWrite` lets the extension change the user's program: every file it writes into its folder is listed in the project's `pxt.json`, so a `.ts` or `.py` file it writes is compiled with the program. Assets are not created through project files: a write of a `.jres` file is refused.
* `allowAssetRead` discloses the project's name beside its assets, palette and simulator theme.
* `allowClipboard` lets the extension's frames read what the user copied, as well as write to the clipboard.
* `allowUsb` lets the extension's frames talk to the USB devices the user pairs; the browser's chooser still stands between the frames and every device.
* `allowSerial` lets the extension's frames talk to the serial ports the user pairs; the browser's chooser still stands between the frames and every port.
* `allowBluetooth` lets the extension's frames talk to the Bluetooth devices the user pairs; the browser's chooser still stands between the frames and every device.
* `allowHid` lets the extension's frames talk to the HID devices the user pairs; the browser's chooser still stands between the frames and every device.
* `allowDisplayCapture` lets the extension's frames capture the user's screen.

Whatever the grants, every simulator frame and tab frame may go fullscreen (`allowfullscreen`) and has the `autoplay` and `microphone` permissions of the main simulator frame; no grant controls them. `allowCamera` gives the extension's frames access to the camera; the browser asks the user before a frame can use it.

## The simulator frame

The simulator frame is the extension's page in the simulator column. It receives the run message and every simulator message, and it may post simulator messages.

### URL parameters

The frame's page receives these parameters in its URL: `parentOrigin` (the editor's origin), `channel` (the extension's key), `apiLevel` (the [API level](#api-level) the editor serves), `language` (the user's language), `target` (the target's id) and `project` (the open project's id, when one is open). `target` and `project` are informational: they grant and select nothing. The frame's id is in the URL's hash.

### Resizing

A simulator extension frame is as wide as the simulator column, and its height follows the `aspectRatio` of its registration. The frame can change its aspect ratio at run time by posting `{ type: "aspectratio", value, frameid }` to its parent, where `value` is the new width-to-height ratio and `frameid` is the frame's id.

### Fullscreen

An extension has two ways to handle fullscreen-simulator mode, in which the simulator fills the editor: listen for the `fullscreen` message and adapt, or set `hideInFullscreen` in its registration to be hidden while the mode is on.

The editor posts `{ type: "fullscreen", enabled }` to every simulator frame when the editor enters or leaves fullscreen-simulator mode, where `enabled` is `true` while the simulator fills the editor. A simulator extension frame whose page finishes loading while the mode is on receives the message once loaded, so a frame that appears during fullscreen knows it. Until a frame receives a `fullscreen` message, the editor is not in fullscreen-simulator mode.

A frame registered with `hideInFullscreen` is hidden while the mode is on, and the main simulator takes the full width beside it. It stays loaded, receives every message, `fullscreen` included, and may keep posting.

## Talking to the editor

The [project files](#project-files), [project assets](#project-assets) and [editor tab](#editor-tab) APIs share one shape. A frame posts a request to its parent, `{ type, id, subtype, ... }`, where `type` names the API (`projfs`, `projassets` or `simxeditor`), `id` is a string the frame chooses, and `subtype` names the request. The editor replies once to each request from one of the extension's frames, to that frame only, with the request's `id`. It drops requests from other windows, and from origins it does not serve.

A refused request is answered with `{ type, id, subtype: "error", code, message }`, where `code` is one of the codes below or one of the API's own, and `message` is for people. The codes every API shares:

* `INVALID_REQUEST`: the request is malformed.
* `UNREGISTERED`: the requesting frame is not a frame of a registered extension the open project includes, or it posted from an origin other than the one its frame was created with.
* `PERMISSION_DENIED`: the registration does not set the grant the request needs.
* `PROJECT_CLOSED`: no project was open when the request arrived, or that project failed to load or has since closed; a later request may succeed.
* `FAILED`: the editor met an error carrying out the request.

A frame should accept a reply, an event or a port only from `window.parent`, and only when the event's origin is the `parentOrigin` its URL carries.

`pxtservices/projfs.ts`, `pxtservices/projassets.ts` and `pxtservices/simxeditor.ts` define each API's messages. The first two also define promise-based clients, `ProjfsClient` and `ProjassetsClient`, which post to the parent at `parentOrigin`, match replies by `id`, and raise `DISPOSED` for a request pending when the client is disposed or made after it. The three files have no dependencies and can be copied into an extension.

### API level

The `apiLevel` URL parameter of the simulator frame and the tab frame names the level of these APIs the editor serves, so a frame knows at startup which requests the editor answers; each of the three files reads it with `getSimxApiLevel`, which returns 0 for an editor that passes none. The level goes up by one whenever a change adds to or alters what a frame can observe of these APIs: a message family, a request, an event, an asset kind or a registration field.

| Level | What it covers |
| --- | --- |
| 1 | The `projfs`, `projassets` and `simxeditor` APIs as this page describes them: their requests, replies, events and asset kinds, and the registration fields. |

## Project files

An extension registered with `allowFileWrite` can list, read, write and delete files in the project with `projfs` requests:

| Request | Reply |
| --- | --- |
| `{ type: "projfs", id, subtype: "list" }` | `{ type: "projfs", id, subtype: "files", files }`, where each of `files` is `{ name, size }`, `size` being the file's size in UTF-8 bytes |
| `{ type: "projfs", id, subtype: "read", name }` | `{ type: "projfs", id, subtype: "content", name, content }` |
| `{ type: "projfs", id, subtype: "write", name, content, dirty }` | `{ type: "projfs", id, subtype: "ack", name }` |
| `{ type: "projfs", id, subtype: "delete", name, dirty }` | `{ type: "projfs", id, subtype: "ack", name }` |

`content` is text, or binary data as a `data:<mime type>;base64,` URI. By default, a write or delete is an artifact: it is saved with the project, and the text editor showing a written file shows the new content, but a running simulator keeps its code until the program next runs. With `dirty: true`, it is a user edit: the editor showing the file shows the new content, the project is typechecked, and the simulator reruns if it runs automatically, just as after the user types. Either way, a write to the file open in the text editor reloads it there, which replaces any change not yet saved from it and resets its undo history and cursor.

### The extension's folder

An extension's folder is the folder of its GitHub repository, `owner/repo/`, whatever subfolder its key names: every registration of the repository, and both frames of each, share the folder. Requests and replies name files relative to it; a file named `notes.txt` is `owner/repo/notes.txt` in the project. Within the folder, `list` and `read` see only the files the project's `pxt.json` lists; a write lists its file, and a delete removes the file from the project and from `pxt.json`.

### Names

* A name is relative: it has no empty, `.` or `..` segment, and `/` and `\` both separate segments.
* A name ending in `.simxeditor` is refused in every request; the suffix is reserved for the editor.
* A write follows the file explorer's rule for a new file: its name starts with a letter, digit or underscore and uses only letters, digits, `_`, `-`, `.` and `/`. A write also refuses a name whose last segment is `pxt.json` or ends in `.jres`, in any letter case, at any depth.
* A stored file whose name does not follow the rules for writes can still be read and deleted.

### Limits

The limits are defined in `webapp/src/projfsHost.ts`:

* `PROJFS_FOLDER_QUOTA_BYTES` (512 KiB): the most the files in a folder may hold, counting the UTF-8 bytes of each file's content and of its name relative to the folder, listed or not. A write that leaves the folder no larger than it was is accepted even while the folder is over the quota.
* `PROJFS_MAX_FOLDER_FILES` (256): the most files a folder may store.
* `PROJFS_MAX_NAME_LENGTH` (128) and `PROJFS_MAX_NAME_SEGMENTS` (8): the most characters, and `/`-separated segments, of a name a write gives a file.
* `PROJFS_RATE_LIMIT` (30) within `PROJFS_RATE_WINDOW_MS` (10 seconds): the most writes and deletes on a folder applied within any such window. Later ones are deferred, not refused: they wait, with the requests behind them, until the window allows them.
* `PROJFS_MAX_PENDING_REQUESTS` (1000): the most requests on a folder that may wait for replies; more are refused with `RATE_LIMITED`.

### Ordering

The editor keeps one queue per folder: it applies a folder's requests one at a time, in the order they arrive, and sends their replies in that order. A request applies to the project open when it arrived, once that project has loaded. Subscribe requests are not queued: the editor answers one without waiting for the requests before it.

### Subscribing

`{ type: "projfs", id, subtype: "subscribe" }` subscribes the requesting frame to changes in its folder and is answered with `{ type: "projfs", id, subtype: "ack" }`. The editor then posts `{ type: "projfs", subtype: "changed", names }` to the frame when files in the folder change: their content, whether they exist, or whether `pxt.json` lists them. `names` holds the names of the files that changed since the last notification, or since the subscription, each once, in the order they first changed, relative to the folder as `list` returns them; a `list` or `read` after it shows the changes. Several changes in quick succession lead to one notification, posted `PROJFS_NOTIFY_DEBOUNCE_MS` (250 milliseconds) after the last change, and no later than `PROJFS_NOTIFY_MAX_DELAY_MS` (2 seconds) after the first, so changes that keep coming are still notified, about every 2 seconds; both are defined in `webapp/src/projfsHost.ts`. The extension's own writes and deletes are notified like any other change.

A frame holds at most one subscription: subscribing again from the same frame is acknowledged and changes nothing, and each frame of an extension subscribes for itself. Subscribe requests are not limited. A subscription ends, without notice, when the project closes or reloads. The editor then removes the extension's frames, whose pages hear `pagehide`, and creates new ones as the next load needs them, so a page subscribes once.

### Error codes

Besides the [shared codes](#talking-to-the-editor):

* `NOT_FOUND`: a read names no file the folder lists, or a delete names a file the folder neither stores nor lists.
* `QUOTA_EXCEEDED`: the write would take the folder over its size or file limit, or its content alone is larger than the folder may hold. Nothing was written.
* `INVALID_NAME`: the name breaks the [name rules](#names).
* `RATE_LIMITED`: the folder already had as many requests waiting for replies as the editor holds; the request was not applied.

A `FAILED` write or delete may be partly applied; repeating it completes it. `PERMISSION_DENIED` means the registration does not set `allowFileWrite`.

## Project assets

An extension registered with `allowAssetRead` can list the open project's assets, and hear when they change, with `projassets` requests.

### Listing

`{ type: "projassets", id, subtype: "list", kind }` lists the project's own assets of one kind, not those of its extensions. `kind` is the name of one of pxt's asset types; a target whose projects hold no assets of a kind lists none, and a kind the editor does not list is refused with `UNSUPPORTED_KIND`. The reply is `{ type: "projassets", id, subtype: "assets", kind, assets, name, palette, theme }`, where `name` is the project's name, `palette` is the project's palette (the project's own if its `pxt.json` sets one, else the target's) as an array of `#rrggbb` colors which a pixel value indexes, and `theme` is the simulator theme the project shows, mapping each token to its value, absent if the target offers no simulator themes.

Each entry of `assets` carries its `kind`, its `id`, and its `displayName` (the name the user gave it, absent if it has none), then the fields of its kind:

| Kind | Fields | Notes |
| --- | --- | --- |
| `image` | `width`, `height` in pixels; `data`, the pixels in the [image encoding](#encodings) | `id` is the key of the image's entry in the project's asset file, which stays the same when the image is renamed. |
| `tile` | as `image` | `id` is the tile's qualified id, as the project's tilemaps reference it, such as `myTiles.tile1`; tilesets reference tiles by qualified id, and tiles supplied by extensions have no other. The blank tile the editor generates for each tile width, such as `myTiles.transparency16`, is one of the project's tiles and is listed. |
| `tilemap` | `tileWidth`, each tile's width and height in pixels; `width`, `height` in tiles; `data`, the tilemap in the [tilemap encoding](#encodings); `tileset`, the tilemap's tiles in order | `id` is the tilemap's id in the project's tileset file, such as `level1`; every tilemap has a `displayName`. Each member of `tileset` is `{ id, width, height, data }` as a tile is, whether the tile is the project's or an extension's; a member whose id names no tile of the project or its extensions has only its `id`. Every tilemap the project holds is listed, empty and unused ones included. |
| `animation` | `width`, `height`, each frame's size in pixels; `interval`, the time each frame shows in milliseconds; `frames`, the frames in order, each in the image encoding | `id` as an image's. |
| `song` | `data`, the song in the [song encoding](#encodings) | `id` as an image's. |
| `json` | `fileName`, the file name the asset carries, absent if it has none; `data`, the JSON value | `id` as an image's. |

The editor answers the list requests of the extensions of one repository in the order they arrive, at most `PROJASSETS_LIST_RATE_LIMIT` (30) within `PROJASSETS_LIST_RATE_WINDOW_MS` (10 seconds), both defined in `webapp/src/projassetsHost.ts`; later ones wait for the window to allow them.

### Subscribing

`{ type: "projassets", id, subtype: "subscribe" }` subscribes the requesting frame and is answered with `{ type: "projassets", id, subtype: "ack" }`. The editor then posts `{ type: "projassets", subtype: "changed" }` to the frame when the project's assets, its name or its visual configuration may have changed; several changes in quick succession lead to one notification, and a `list` after it shows them all. The notification is posted `PROJASSETS_NOTIFY_DEBOUNCE_MS` (250 milliseconds) after the last change, and no later than `PROJASSETS_NOTIFY_MAX_DELAY_MS` (2 seconds) after the first, so changes that keep coming are still notified, about every 2 seconds; both are defined in `webapp/src/projassetsHost.ts`.

A frame holds at most one subscription: subscribing again from the same frame is acknowledged and changes nothing, and each frame of an extension subscribes for itself. Subscribe requests are not limited. A subscription ends, without notice, when the project closes or reloads. The editor then removes the extension's frames, whose pages hear `pagehide`, and creates new ones as the next load needs them, so a page subscribes once.

### Error codes

Besides the [shared codes](#talking-to-the-editor):

* `UNSUPPORTED_KIND`: the editor does not list assets of the requested kind.

`PERMISSION_DENIED` means the registration does not set `allowAssetRead`. `PROJECT_CLOSED` also answers a request whose project was replaced before the request was answered.

## Editor tab

A simulator extension can also contribute an editor tab: a page of the extension that the editor shows in the editor area, beside Blocks and the text editors, while the simulator stays visible. The editor lists the tab in the language dropdown of the editor toggle, after JavaScript and Python. Switching between the tab and Blocks leaves the simulator running, in both directions. The tab is offered only while the open project includes the extension from GitHub (a `github:` dependency; an extension added from a file or a local folder gets no tab), and never in views whose editor toggle lists no tabs: embedded (sandbox), read-only (such as the time machine), tutorial and debugging views, and targets that hide the menu bar or show Blocks only.

A tab may also create the instances of a fixed-instance type for the block dropdowns that list them (see `editor.creates` in [Declaring the tab](#declaring-the-tab)).

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
        "icon": "brand/icon.svg",
        "creates": ["myext.Thing"]
    },
    "allowEditorTab": true
}
```

* `editor.index` is the tab's page, a path within the extension's published files, resolved the same way as `index`.
* `editor.label` names the tab in the toggle and is its accessible name. It is text, or a map from language code to text, from which the editor picks the user's language (its region in either letter case), then its base language, then `en`, then the first entry with text. It is shown as text, as the names of Blocks, JavaScript and Python are. When it is absent or names nothing in any language, the tab is named by the registration's key and the editor logs it.
* `editor.icon` is an optional icon shown on the label's left. It is either the class names of one of MakeCode's font icons, as its own editors use (for example `xicon js`), or the path to an SVG within the extension's published files, resolved the same way as `index`. A value that contains a `/` or ends in `.svg` is a path; any other value is class names.
* An SVG icon is drawn as a mask in the toggle's text color: only its shape is used, so it follows the editor's color themes, high contrast included. A square SVG drawn in a single color, such as `currentColor`, is recommended.
* `editor.creates` is an optional list of the fully qualified names of fixed-instance types whose instances the tab creates, such as `myext.Thing`. The dropdown of a block parameter of such a type, which lists the instances the project declares, then ends with a "New ..." entry naming the type by its `block` attribute, else by its name in lower case, while the editor offers the tab. Picking the entry leaves the parameter as it was, shows the tab, and posts it the [`action` event](#lifecycle-events) asking it to create an instance, typically by writing the project file that declares it. The dropdown also offers an "Edit ..." entry naming the current instance when a file in the extension's folder declares it: picking it shows the tab and posts it the `action` event asking it to open the instance. A parameter that names its own `fieldEditor` gets no entry. The editor honors a claim only on a type declared by a package of the extension's own repository (the repository its key names, whatever subfolder), and ignores, and logs, any other; of two registrations the project includes that claim one type, the first in registration order creates its instances and the other is logged.
* `allowEditorTab` enables the tab. The editor offers no tab unless the registration sets both `editor`, with its `index`, and `allowEditorTab`; it logs a registration that sets `allowEditorTab` without them.
* A registration with an editor tab must be `permanent` (the default); the editor ignores, and logs, an `editor` on a registration with `permanent: false`.

The editor selects the tab through a session-only marker file named after the extension's key (`owner~repo.simxeditor`), which it creates the first time the tab is opened in a session. The marker is never saved, listed with the project's files, shared or exported, so the project itself does not change. File names ending in `.simxeditor` are reserved for these markers.

### Two frames

An extension with an editor tab has two frames, both created for its key:

* Its **simulator frame**, in the simulator column, is [the simulator frame](#the-simulator-frame) as before. Its URL also carries `editor=1` when the open project includes the extension, so the frame knows at startup that the tab exists.
* Its **tab frame**, in the editor area, is created the first time the tab is opened and removed when the project closes or reloads. Its URL carries the same parameters as the simulator frame's plus `role=editor`, and it gets the same sandbox and permissions under the same grants: it may send [project-file](#project-files) and [project-asset](#project-assets) requests just as the simulator frame may, in the same folder and under the same limits. It is not a simulator frame: it receives no simulator messages, and nothing it posts is relayed to the simulator. The editor-wide messages any frame may post, such as `screenshot` and `addextensions`, are handled from it as from a simulator frame.

Whenever the editor shows the tab and the extension's simulator frame does not exist (for example, because the program has not run), the editor creates it. It also creates it again after the simulator unloads while the tab exists, as when the simulator theme picker closes.

### Ready, and the port

The editor shows a loading indicator, labeled with the tab's label, over the tab until the tab frame posts `{ type: "simxeditor", event: "ready" }` to its parent. Post it once the page listens for messages.

Once the tab is ready and the simulator frame has loaded, the editor creates a `MessageChannel` and posts `{ type: "simxeditorport", key }` to each frame, with one of the channel's ports in the event's `ports[0]`. The two frames talk over that channel; the editor never reads it. The editor brokers a new pair whenever a new simulator frame of the extension loads, as when the editor creates it again after the simulator unloads, so both frames should accept a new port at any time. Either side may close its port.

### Lifecycle events

The editor posts these messages to the tab frame:

* `{ type: "simxeditor", event: "shown" }` and `{ type: "simxeditor", event: "hidden" }` when the user switches to or away from the tab, and once after the tab is ready.
* `{ type: "simxeditor", event: "simulator", command }` as the editor starts, stops or restarts the simulator, where `command` is `"start"` (on every run that reaches the simulator, including the automatic reruns after an edit), `"stop"` or `"restart"` (when the editor restarts the program already in the simulator). The event carries no program; the simulator frame receives the run message and can share it over the port.
* `{ type: "simxeditor", event: "simulatorstate", state }` when the simulator's state changes, and once after the tab is ready, where `state` is one of `"Unloaded"`, `"Stopped"`, `"Pending"`, `"Starting"`, `"Running"`, `"Paused"` and `"Suspended"`.
* `{ type: "simxeditor", event: "fullscreen", enabled }` when the editor enters or leaves fullscreen-simulator mode, and once after the tab is ready, where `enabled` is `true` while the simulator covers the editor area, and with it the tab. The simulator frame receives the [`fullscreen` message](#fullscreen) at the same time, so an extension whose tab is its main view can show that view in the simulator frame while the tab is covered.
* `{ type: "simxeditor", event: "action", action, qName }` when the user asks, outside the tab, for something the tab does, where `action` is `"create"`: create an instance of the type `qName`, one of those `editor.creates` names. For `"open"`, `qName` is instead an instance of such a type, declared by a file in the extension's folder, for the tab to open. The editor shows the tab and posts the event once the tab is ready: at once if it is, else right after the events that follow its ready event. A later request replaces one not yet posted, and one not yet posted is dropped when the tab frame is removed.

A tab lives for one load of its project: the editor removes the tab frame when the project closes or reloads, and the ports and project-asset subscriptions the tab held end with it. The editor posts no message before removing the frame; to save state, listen for `pagehide` on the tab's window.

A hidden tab stays loaded, but it is not rendered, and the browser may run its timers late or not at all. Render only while the tab is shown, and keep any computation that must not pause, such as a simulation, in the simulator frame, which is visible whenever the simulator is. A tab that runs simulators of its own is responsible for them while it is hidden, for example by pausing them.

### Opening the tab from the simulator frame

The simulator frame may ask the editor to show the tab, for example when the user clicks a button in it, by posting `{ type: "simxeditor", subtype: "open", id }` to its parent. The editor shows the tab, creating the tab frame if needed, and replies to the simulator frame with `{ type: "simxeditor", id, subtype: "ack" }`, or with an error whose `code` is one of the [shared codes](#talking-to-the-editor) or `UNAVAILABLE` (the editor shows no tabs in its current view). Here `UNREGISTERED` means the frame is not the simulator frame of a registered extension the open project includes, `PERMISSION_DENIED` that the registration does not declare and enable a tab, and `INVALID_REQUEST` that the request is unknown or the editor failed to carry it out.

## Encodings

The asset data the editor lists is in pxt's own encodings, as the project's asset files store it:

* **Image** (`image/x-mkcd-f4`): the pixels of an image, a tile or an animation frame, base64-encoded.
* **Tilemap** (`application/mkcd-tilemap`): the bytes written as hexadecimal text, then base64-encoded. The bytes are the tile width; the width and then the height, each 16 bits, little-endian; one byte per cell, row by row, holding the index in the tilemap's `tileset` of the tile the cell shows; then the walls, 4 bits per cell, row by row, two cells per byte with the first in the low bits, nonzero for a wall.
* **Song** (`application/mkcd-song`): the song's bytes as hexadecimal text, not base64-encoded.
