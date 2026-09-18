# Project tools

Project tools provides **Documentation**, **Whiteboard**, and **Backpack** panels.
Enable `appTheme.projectTools` in the target, use **Project tools bubbles** under
**Settings → About → Experiments**, or preview with `?projecttools=1`.
`appTheme.whiteboard` and `appTheme.backpack` independently enable those panels
and the launcher in eligible project editors. Set either to `false` to hide it.
Only Whiteboard requires a runtime image palette.

## Controls

- Select a bubble to open or close its panel; **…** hides or reveals the bubbles.
- Pin the panel to keep it open when working elsewhere. Escape closes it and
  returns focus without clearing the pin or draft.
- Arrow keys and Home/End navigate tabs; horizontal tabs use Enter/Space to open.
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
Standalone image, animation, tilemap and music blocks go to **Assets** instead of
**Code**, based on their registered field editor, including extension-defined blocks.
Required extensions are installed with consent on Add, just as for code snippets.
Field implementations can opt in with `isBackpackAsset`; asset gallery grid pickers
use `fieldOptions.asset=true`. New asset editors require no backend type registration.
Limits are 50 code captures and 200 assets per target, with a shared
50 MiB account cap. Asset previews are generated locally using the gallery renderer,
not stored as PNGs. Tilemaps include their required tile pixels.
Reopening rechecks metadata while keeping the previous cards visible. Returning
to the browser tab or opening a different project shows Loading until metadata
is refreshed (after closing any open edit dialog). Previews are cached by item
version in bounded, account-scoped session memory; only new,
changed or evicted previews are downloaded. Add/Edit still read current content.

Guests save in this browser; signing in syncs captures across browsers. Search
matches names, contained blocks, parameters and extensions. Rename is optional.
The **+** button or dragging a preview into the workspace asks permission before
installing missing extensions and inserts the capture as one undo group. Custom
TypeScript source is not included: copy the required files or publish an extension
if the destination lacks those blocks.
Ordinary clipboard paste uses the same dependency checks while retaining normal
Blockly copy/cut/paste behavior.
The pencil renames code captures; for assets it opens the native editor in an
isolated popup from Blocks, text, or the Assets view. Adding blocks still requires
the Blocks view. Use its bottom name field and **Done**; closing works like the
Assets tab and saves to Backpack, not project assets. Captures store target/PXT
versions and warn before cross-version imports.

Failed uploads retain a local copy with **Retry sync**. After 24 hours, add that
copy to a project and capture it again. Invalid entries remain trashable.
Deleting a pending local copy does **not** delete a cloud copy that may already
have synced; delete the cloud card separately. Inserted project code is unaffected.

Do not clear all browser storage: that also removes unsynced captures and projects.

See [testing](../tests/project-tools-test/README.md) for developer checks.