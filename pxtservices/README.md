# pxtservices

Shared TypeScript for talking to the MakeCode editor from outside its page:
the clients and message definitions that the editor's companion apps and
simulator extensions use. It compiles on its own (tsconfig.json here, output
in built/pxtservices) and nothing in it depends on the webapp, so each module
can be imported by a separate app or copied into an extension.

## Driving the editor from another page

- editorDriver.ts drives an embedded MakeCode editor iframe: load and save
  projects, run the simulator, and hear workspace events. Used by the tutorial
  tool and the teacher tool.
- iframeDriver.ts is the request-and-reply plumbing editorDriver.ts and
  assetEditorDriver.ts share: posting a request to an iframe and resolving the
  matching response.
- assetEditorDriver.ts drives an embedded asset editor iframe.
- iframeEmbeddedClient.ts is the other side: what the webapp runs when it is
  the embedded iframe, to announce itself to the host page and receive the
  message port.
- backendRequests.ts, loggingService.ts and constants.ts are small helpers
  the companion apps share: fetching JSON documents from the backend, logging
  errors as events, and the error codes they report.

## Simulator extensions

A simulator extension runs in frames the editor creates, and the editor
answers its requests by message. The specification is
[simulator-extensions.md](./simulator-extensions.md): the registration fields
and grants, the frames and their URL parameters, each message family with its
limits, ordering and error codes, the editor tab, and the asset encodings.
The introduction for extension authors is in
common-docs/extensions/simulator-extensions.md.

The clients, one per message family, are standalone and dependency-free, so
an extension copies the ones it needs:

- projfs.ts: list, read, write, delete and subscribe to the files in the
  extension's folder of the project (grant `allowFileWrite`).
- projassets.ts: list the project's assets, name, palette and simulator theme,
  and subscribe to changes (grant `allowAssetRead`).
- projprogram.ts: compile the project and receive the program the simulator
  runs (grant `allowProgramRead`).
- simxeditor.ts: the editor tab's lifecycle, simulator and action events, its
  port to the simulator frame, and the simulator frame's request to open the
  tab (grant `allowEditorTab`).

Each client reads `parentOrigin` and `apiLevel` from its frame's URL through
readers it exports (projfs.ts also reads `channel`, `target` and `project`),
and accepts replies and events only from the editor window at that origin.
