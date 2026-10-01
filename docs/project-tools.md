# Project tools

Project tools provides **Documentation**, **Whiteboard**, and **Backpack** panels.
Enable `appTheme.projectTools` in the target. `appTheme.whiteboard` and
`appTheme.backpack` independently enable those panels and the launcher in
eligible project editors. Set either to `false` to hide it. Only Whiteboard
requires a runtime image palette.

## Controls

- Select a bubble to open or close its panel; **…** hides or reveals the bubbles.
- Pin the panel to keep it open when working elsewhere. Escape closes it and
  returns focus without clearing the pin or draft.
- Tab/Shift+Tab visits each visible tool bubble. Arrow keys and Home/End also
  navigate the bubbles; Enter/Space opens or closes a panel.
- Drag the resize grips, or focus a grip and use arrow keys (Shift for larger
  steps). Both width and height resizing work on desktop and mobile.

## Whiteboards

Use the header menu to create, rename, select, or delete up to eight boards.
Each has independent drawing, text and undo history. Deleting a board requires
confirmation, keeps at least one board, and cannot be undone with drawing Undo.

Notes autosave with the project and sync to its signed-in owner. They are **not
included in public shares, file exports, GitHub source, or game assets**. Undo
history lasts only for the current editor session. Save failures offer Retry;
wait for saves/sync before closing or switching devices.

## Backpack

Requires `appTheme.backpack`. Without sign-in support, captures remain local and
no sign-in prompt is shown. `appTheme.assetEditor` enables the **Code / Assets**
toggle; otherwise only code snippets are shown. During tutorials it opens to
**Assets** when available; code snippets cannot be saved or added during tutorials.

In an editable Blocks project, use **Add to Backpack** on an event, loop, if block
or function definition, or drag it onto Backpack. This copies its contents,
referenced Blockly functions and assets—not following siblings or the originals.
Legacy procedure blocks are not supported; recreate them using Functions blocks.
Standalone image, animation, tilemap and music blocks go to **Assets** instead of
**Code**, based on their registered field editor, including extension-defined blocks.
Statements and expressions with asset fields save the asset separately. If there
is more than one field, choose which asset to save from the dialog. Cancelling
saves nothing, and the source block is never changed. Containers such as events
and loops still save their entire contents as **Code**, including any asset fields.
Required extensions are installed with consent on Add, just as for code snippets.
Blocks defined in the project's own TypeScript files cannot be saved to Backpack.
Move that code into an extension, publish it, and add the extension to the project
before saving those blocks. Individual assets can still be extracted if their
standalone asset block does not depend on the custom files.
Asset field implementations can opt in with `isBackpackAsset`. Ordinary dropdowns
such as Minecraft's block picker are not Backpack assets.
Limits are 50 code captures and 200 assets per target, with a shared
50 MiB account cap. Asset previews are generated locally using the gallery renderer,
not stored as PNGs. Tilemaps include their required tile pixels.
Reopening rechecks metadata while keeping the previous cards visible. Returning
to the browser tab or opening a different project shows Loading until metadata
is refreshed (after closing any open edit dialog). Previews are cached in memory
for the current account. Only new, changed or evicted previews are downloaded.
Adding or editing an item reads its saved content again.

Guests save in this browser; signing in syncs captures across browsers. Search
matches names, contained blocks, parameters and extensions. Rename is optional.
The **+** button or dragging a preview into the workspace asks permission before
installing missing extensions and inserts the capture as one undo group.
Ordinary clipboard paste uses the same dependency checks while retaining normal
Blockly copy/cut/paste behavior.
The pencil renames code captures; for assets it opens the native editor in an
isolated popup from Blocks, text, or the Assets view. Adding blocks still requires
the Blocks view. Use its bottom name field and **Done**; closing works like the
Assets tab and saves to Backpack, not project assets. Captures store target/PXT
versions and warn before cross-version imports.

Failed uploads retain a local copy with **Retry sync**. After 24 hours, add that
copy to a project and capture it again. Invalid entries can still be deleted.
Deleting a pending local copy does **not** delete a cloud copy that may already
have synced; delete the cloud card separately. Inserted project code is unaffected.

Do not clear all browser storage: that also removes unsynced captures and projects.

See [testing](../tests/project-tools-test/README.md) for developer checks.

## Developer notes

The launcher, panel shell and Whiteboard components are grouped in
[`webapp/src/components/projectTools`](../webapp/src/components/projectTools).
Backpack's components and hooks live in the sibling
[`webapp/src/components/backpack`](../webapp/src/components/backpack) folder.
Storage, serialization and other non-UI services remain in `webapp/src` and
`pxtblocks`; shared image-editor components stay outside the feature folder.

`ProjectBackpack` owns item actions and dialog selection. `useBackpackCollection`
handles subscriptions, pending operations and queued refreshes. `BackpackToolbar`
renders the category and search controls; `useBackpackPageFocus` and `useBackpackDrag`
handle browser-focus and drag events. Item dialogs own their input focus.
`useProjectWhiteboard` manages notes, autosaves, conflicts and per-board undo
stores; `ProjectWhiteboard` renders the editor and its controls.
Feature classes use hyphenated names such as
`project-backpack-item`; update their event and test selectors together.

Project tools use `react-common` controls. Buttons use `nativeBehavior` to retain
browser keyboard activation and click propagation, and `hardDisabled` where
pending operations must disable interaction. Keep the
feature's sizing, colors and focus treatment when reusing controls; retain native
form inputs and submit buttons where their validation attributes are needed.
Actions have localized descriptive titles alongside their visible or ARIA labels.
Only explicitly marked user errors are displayed. Unexpected exceptions are
reported separately and use a localized, operation-specific failure message.
Mark actionable failures such as invalid names, storage limits, sign-in and
concurrent-edit conflicts, not malformed IDs, timestamps, preview metadata or
internal editor state.

Blockly's Backpack drag registration is in `pxtblocks/backpackDrag.ts`, separate
from capture and serialization.
Blockly registration receives its drag targets from the webapp host. Shared
project-tools IDs keep the launcher, panel accessibility links and drag adapter
in sync; serialization does not depend on those DOM elements.
Captures use a versioned `{ version: 1, blocks: [...] }` envelope containing
Blockly's native clipboard block states. Earlier unversioned captures remain
readable; unsupported future versions are rejected without loading their blocks.
Copy/paste and Backpack share the native clipboard paster and placement helper.
Blockly loads block fields and mutations. Backpack checks its versioned wrapper,
size limits and supporting functions.
Launcher bubbles are disclosure buttons in a labelled group, with named regions
for their panels. Each visible bubble is a Tab stop; hidden bubbles are excluded
from the tab order.