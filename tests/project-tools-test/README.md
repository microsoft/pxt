# Project tools tests

Run `gulp testprojecttools` from PXT. It rebuilds the shared library and webapp
modules before running the tests. The task is included in `gulp test`.

Browser suites share [browser.js](browser.js). On GitHub Actions only, they use
`--no-sandbox`, matching the repository's Karma launcher for Ubuntu runners that
restrict Chromium user namespaces, and `--disable-gpu` for software rendering.
Without a usable display, headless Chromium's GPU initialization can stall
stylesheet/script injection in `beforeEach`; increasing Mocha's timeout does not
fix that renderer hang. DOM, focus, CSS animation, and 2D canvas tests still use
the real browser. Local runs retain the Chromium sandbox and normal graphics.
Neither setting changes the editor or its iframe sandbox attributes.
Browser protocol commands have a 10-second deadline so a stall reports the
underlying DevTools operation before Mocha's unchanged 30-second hook timeout.

- [storage.spec.js](storage.spec.js) exercises actual workspace/cloud code with a
  fake persistent provider and authenticated API. No network requests or public
  shares are created. Private notes must survive save, duplication and account
  sync, but never enter anonymous/persistent publish payloads. Fault tests cover
  note edits during uploads/downloads and persistent-storage failure/retry.
- [keyboard.spec.js](keyboard.spec.js) checks the actual image-editor shortcut
  router using minimal DOM owners, independent stores and editable controls.
  It covers scoped keys, text undo, nested editors and listener/lock teardown.
- [launcher.spec.js](launcher.spec.js) uses Puppeteer and real React to check the
  horizontal/vertical bubble animation, persistent options, keyboard focus and dismissal,
  the always-visible ellipsis, desktop-expanded versus mobile/tablet-collapsed
  startup without autofocus, the 1199/1200px strip breakpoint, and preserving a mounted draft.
  Explicit desktop disclosure choices survive orientation changes; the separate
  991/992px breakpoint sets the default visibility. Desktop click-away closes the
  panel without hiding the bubbles. Small-desktop
  checks retain desktop header/footer spacing and both resize grips, with the
  width grip only hiding at the separate 991px tablet breakpoint. It compiles the production
  LESS with test theme variables and checks RTL, reduced-motion behavior, banner
  offsets, ellipsis alignment, speech-bubble pointers, and panel dismissal via
  the ellipsis, outside controls, keyboard focus and the simulator iframe.
  Pin regressions cover click-away/iframe focus, explicit collapse and reopening,
  manual unpin, example defaults, and switching tabs/viewports.
  Resize tests cover side/bottom grips, pointer and keyboard input, RTL, retained
  dimensions and viewport/banner limits. Grip dots are included in theme contrast checks.
  Default-size tests compare the combined desktop panel/bubble footprint with
  legacy sidedocs, exercise breakpoint transitions, and verify target overrides
  and preserved manual sizes.
  The whiteboard is stubbed; no development server is needed. Puppeteer's browser
  must be installed.
- [whiteboard.spec.js](whiteboard.spec.js) loads the actual image editor, reducer,
  whiteboard controller and header menu. Storage and game-asset access are mocked,
  not the controls. It covers new and saved notes, named-board operations, independent
  images/text/undo, confirmed deletion and last-board protection, save errors/retry,
  desktop hide/reveal with retained notes/drawing/undo/pin, all 16 colors on mobile
  and footer spacing.
  Contrast checks use the production stylesheet order (shared menu styles load
  after project-tools) and the actual theme manager. They check icons, text and
  keyboard focus through idle/hover/pressed/expanded states on mobile and desktop,
  plus system forced colors. Light/dark regression palettes and shared high
  contrast always run. With the sibling Arcade checkout (or `PXT_ARCADE_PATH`),
  every Arcade color theme and its override CSS is included automatically.

Bitmap/schema checks and the startup experiment guard are also covered by
[the editor suite](../pxt-editor-test/editorrunner.ts), run with `gulp testpxteditor`.
See the [feature notes](../../docs/project-tools.md) for manual UI/privacy checks.

## Backpack: focused tests without builds

Run `node node_modules/mocha/bin/mocha.js "tests/project-tools-test/backpack-{storage,ui,project,blocks,editor}.spec.js" --reporter dot`
from PXT for the source-based backpack suites. They transpile the relevant current
TypeScript in memory; they do not run a build, development server, live sign-in,
network download, or user program. Browser suites require Puppeteer's Chromium.
The storage harness uses the existing built JSON-patch utility when available,
otherwise its source, and always loads the dependency-reference parser from source.

Run the separate [real asset suite](backpack-assets.spec.js) with
`node node_modules/mocha/bin/mocha.js tests/project-tools-test/backpack-assets.spec.js --reporter dot`.
It requires existing, up-to-date PXT library/simulator and Blockly build output,
including the backpack and asset-field modules. It does **not** rebuild them.
After changing those production sources, stale build output is not evidence that
the changes pass. Do not use `gulp testprojecttools` for a no-build check: that task
rebuilds the shared library and webapp first.

- [backpack-storage.spec.js](backpack-storage.spec.js): actual local/profile store and
  JSON-patch semantics with fake authenticated API responses shared by simulated
  devices and simulated native Storage shared by tabs/reloads. Covers guest CRUD,
  import, storage failures/quotas, guest-to-profile upload/cleanup acknowledgements,
  collision and account-change guards, acknowledgement/retry, target isolation,
  corrupted-data recovery, detached snapshots/imports, and optional `projectBlocks`
  validation, bounds, cloning, round-trip persistence/removal and acknowledgement
  mismatch detection. No real profile data is read or written.
- [backpack-ui.spec.js](backpack-ui.spec.js): current panel, real React, validator,
  standalone LESS, focus and keyboard behavior; auth, package access and storage/import
  operations are mocked. Covers usable guest contents with/without an identity
  provider, the centered sign-in button, local/profile deletion, refresh/reopen, account
  changes, literal names/previews/source filenames, deduplicated source requirements,
  missing-only extension requirements and updates as packages change, import restrictions,
  the real shared delete modal and focus trap,
  confirmation/retry/focus, quiet add/delete outcomes,
  mobile overflow/touch sizes and theme/forced-color focus. This suite does not
  install extensions or exercise the source-file popup itself.
- [backpack-editor.spec.js](backpack-editor.spec.js): extracts the current Blocks
  editor integration methods into a source-transpiled fixture. Covers guest and
  signed-in context saves without blocking sign-in, same-ID retries, editor guards,
  account changes during preview/save and captured import-host validity. Storage,
  serialization and project import are stubbed at their tested module boundaries.
- [backpack-project.spec.js](backpack-project.spec.js): current requirement capture
  and the shared [snippet preparation](../../webapp/src/blockSnippet.ts) with the
  production package conflict engine. Covers ordinary states and backpack adapters, used
  packages only, dropdown/asset/function-type references, local source metadata,
  missing-source popups, consent/cancel, source conflicts, target restrictions,
  transitive dependency preflight, preservation of unsaved code/asset config,
  fresh definitions after reload, and account/project changes during async work.
  Downloads and the host are fake; a focused case uses real Blockly paste/undo.
- [clipboard.spec.js](clipboard.spec.js): source-extracted Copy/Cut/Paste handlers
  wired to the real shared preparation module. Covers used extension/source capture,
  comment/native copy data, cut failures without deletion, metadata-free clipboard
  entries, installation consent/cancel, source warnings, fresh workspaces after reload,
  placement, tutorial restrictions, concurrent paste and project/account changes.
  An isolated Blockly browser case checks full field state on an ordinary expression.
  Run it directly with `node node_modules/mocha/bin/mocha.js tests/project-tools-test/clipboard.spec.js`.
  It needs no build, dev server, account, or real network downloads.
- [backpack-blocks.spec.js](backpack-blocks.spec.js): current serialization, native
  function plugin and dragger with installed Blockly. Covers container boundaries,
  full field state, recursive function remapping, invalid payloads, grouped undo,
  native drag restoration, context-menu eligibility, 500ms dwell without focus
  theft, moving drop bounds, hidden-tab launcher fallback and cancellation cleanup.
  Its synthetic asset field checks full-serialization plumbing, not real images.
- [backpack-assets.spec.js](backpack-assets.spec.js): real compiled image/tilemap
  fields, field lifecycle and `TilemapProject` in Chromium. Replaces the entire
  source asset project before paste, then checks named image pixels, tilemap cells,
  walls, dimensions and custom tiles; conflicting IDs preserve destination assets,
  repeated paste deduplicates equivalent assets, and temporary inline images
  round-trip. Also checks registered PXT legacy procedure XML, recursion, name
  collisions, undo/redo and invalid mutations. Asset serializers are not mocked.

## Backpack behavior and manual checks

The implementation lives in [the local/profile store](../../webapp/src/backpack.ts),
[the panel](../../webapp/src/components/ProjectBackpack.tsx),
[project insertion](../../webapp/src/backpackProject.ts), and
[Blockly serialization/drag targets](../../pxtblocks/backpack.ts).

1. **Local storage and profile sync.** Guests can save, insert and delete snippets
  without a sign-in dialog. Native localStorage keys are
  `<targetId>/backpack/guest/<itemId>`: per-entry writes preserve other tabs' data
  and unrelated keys. Browser-storage failures must not report a memory-only save
  as durable. The centered top button offers sign-in to save across browsers; it is
  absent in editors without an identity provider, where local use still works.
  Signed-in snippets live in preferences at `backpack[targetId][itemId]`, not in
  project files. On signed-in open/save, local items are added without replacing
  profile items, validated against quota/collisions before writes, and removed
  locally only after identical server acknowledgement. Failed/lost replies retain
  local data and retries must not duplicate uploads. Guest edits during upload
  are retained. Opening/reopening automatically loads current contents; there is
  no Refresh button or routine sync-success message. Failed loads offer Retry.
  This is not continuous push sync. Check a second device
   with the same account and target, then sign out/switch accounts: old entries
  must disappear and late operations must not populate the new account's panel
  or copy profile data into guest storage. Clearing browser storage removes
  unsynced local snippets.
2. **Limits and isolation.** Each target/editor holds at most **50 items**.
   The **500,000-character serialized JSON limit is shared across all targets**
  in the account's backpack; guest storage applies that limit per target. Each item has
   a UUID, a 1–100-character nonblank name without control characters, at most
   100,000 code characters, 100 portable dependencies, and an optional PNG data
   URI of at most 32,000 characters. Optional `projectBlocks` maps at most 500
   block types to source filenames, each nonempty and at most 256 characters
   without control characters; unsafe prototype keys are rejected. It records
   filenames, not source contents. Verify a full target can update/delete existing
   items and another target's entries/preferences remain untouched.
3. **Copy a container.** In an eligible editable Blocks project (not temporary,
   locked/read-only, or an unfinished tutorial), right-click/hold a movable,
   editable block with a statement input and choose **Add to Backpack**. Plain
   statements, shadows and flyout/mutator blocks are not eligible containers.
   Only the chosen container and its input bodies are copied—not its ancestors
   or following siblings—plus transitive referenced Blockly function definitions
   and fully serialized assets. The original is never deleted. Dragging onto the
   Backpack bubble/panel also copies; dwelling over the bubble for **500ms** opens
   the panel without moving focus. The launcher is a fallback when the bubble is
   hidden. Drop into the backpack and verify original connections/location are
   restored; leaving, Escape, pointer cancellation or disposal clears hover/dwell.
  A failed local save or sync offers Retry using the same captured item ID.
4. **Required extensions.** Entries list only captured package references missing
  from the current project, with no extension heading or list when all requirements
  are already installed. Only used packages are captured, not every
   installed extension. Portable sources are bundled `*`, GitHub references and
   published IDs; local/workspace/file packages require publishing and installing
   the published extension first. Add to project requires an eligible Blocks editor.
   Missing packages prompt **Add required extensions?** with **Add extensions and
   snippet**; Cancel performs no downloads or project writes. After consent, the
   importer checks the full dependency graph and target permissions before writes,
   saves current code, installs missing requirements and reloads definitions before
   paste. Conflicting sources/core replacements are refused, not silently replaced.
   An installed version of the same case-insensitive GitHub repository is retained,
   not upgraded; unavailable blocks still prevent insertion. Paste is one undo group.
5. **Project source requirements.** Entries list unique original source filenames
   and explicitly say their source code is not included. If a recorded block type
   is absent from current project `BlocksInfo`, Add shows **Project code is required**
   with the missing filenames and an OK button, before extension consent/downloads.
   Copy the required code into the destination or publish it as an extension.
   A stale global Blockly registration is insufficient; source requirements are
   checked again after reload. The panel's warning does not itself disable Add.
6. **Local or synced deletion.** Delete opens a modal asking whether to remove the
  item **in this browser** for guests or **on all devices** when signed in.
  Cancel/Close/Escape preserves it and returns focus without closing the panel.
  During a pending/failed request, the entry remains; errors stay in the modal for
  retry. The background is hidden from screen readers and focus stays in the modal.
  Routine add/delete progress, success and cancellation text is not shown in the panel.
  After acknowledgement, focus goes to the next/previous entry or the panel when
  empty. Reopen in another tab/browser to verify removal. Deleting a backpack
   entry does not remove copies already inserted into projects.