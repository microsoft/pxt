# Project tools

Project tools provides **Documentation**, **Whiteboard**, and **Backpack** panels.
Enable `appTheme.projectTools` in the target, use **Project tools bubbles** under
**Settings → About → Experiments**, or preview with `?projecttools=1`.
The feature requires an eligible project editor and image palette.

## Controls

- Select a bubble to open or close its panel; **…** hides or reveals the bubbles.
- Pin the panel to keep it open when working elsewhere. Escape closes it and
  returns focus without clearing the pin or draft.
- Arrow keys and Home/End navigate tabs; horizontal tabs use Enter/Space to open.
- Drag the resize grips, or focus a grip and use arrow keys (Shift for larger
  steps). Width resizing is available on desktop; height resizing works on mobile.

## Whiteboards

Use the header menu to create, rename, select, or delete up to eight boards.
Each has independent drawing, text and undo history. Deleting a board requires
confirmation, keeps at least one board, and cannot be undone with drawing Undo.

Notes autosave with the project and sync to its signed-in owner. They are **not
included in public shares, file exports, GitHub source, or game assets**. Undo
history lasts only for the current editor session. Save failures offer Retry;
wait for saves/sync before closing or switching devices.

## Backpack

Requires `appTheme.backpack` and sign-in support; hidden during tutorials and in
offline apps. Guests can use it without signing in when sign-in is available.

In an editable Blocks project, use **Add to Backpack** on an event, loop, if block
or function definition, or drag it onto Backpack. This copies its contents,
referenced Blockly functions and assets—not following siblings or the originals.
Standalone image, animation, tilemap and music blocks go to **Assets** instead of
**Code**. Limits are 50 code captures and 200 assets per target, with a shared
50 MiB account cap. Asset previews are generated locally using the gallery renderer,
not stored as PNGs. Tilemaps include their required tile pixels.

Guests save in this browser; signing in syncs captures across browsers. Search
matches names, contained blocks, parameters and extensions. Rename is optional.
The **+** button or dragging a preview into the workspace asks permission before
installing missing extensions and inserts the capture as one undo group. Custom
TypeScript source is not included: copy the required files or publish an extension
if the destination lacks those blocks.
Ordinary clipboard paste uses the same dependency checks while retaining normal
Blockly copy/cut/paste behavior.
The pencil renames code captures; for assets it opens the native editor in an
isolated popup. Use its bottom name field and **Done**; closing works like the
Assets tab and saves to Backpack, not project assets. Captures store target/PXT
versions and warn before cross-version imports.

Failed uploads retain a local copy with **Retry sync**. After 24 hours, add that
copy to a project and capture it again. Invalid entries remain trashable.
Deleting a pending local copy does **not** delete a cloud copy that may already
have synced; delete the cloud card separately. Inserted project code is unaffected.

Do not clear all browser storage: that also removes unsynced captures and projects.

See [testing](../tests/project-tools-test/README.md) for developer checks.