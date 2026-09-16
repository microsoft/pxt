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
  Hover/focus labels omit the open tab, include the ellipsis, and paint above the
  panel in both layouts, with RTL positioning and theme/forced-color contrast checks.
  Pin regressions cover click-away/iframe focus, explicit collapse and reopening,
  manual unpin, example defaults, and switching tabs/viewports.
  Resize tests cover side/bottom grips, pointer and keyboard input, RTL, retained
  dimensions and viewport/banner limits.
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
  Keyboard focus indicators are checked on mobile and desktop using the production
  stylesheet order (shared menu styles load after project-tools). System forced-color
  checks remain, but the suite does not enforce numeric contrast thresholds across
  every editor theme; those palettes can intentionally include lower-contrast colors.

Bitmap/schema checks and the startup experiment guard are also covered by
[the editor suite](../pxt-editor-test/editorrunner.ts), run with `gulp testpxteditor`.
See the [feature notes](../../docs/project-tools.md) for manual UI/privacy checks.

## Backpack: focused tests without builds

Run `node node_modules/mocha/bin/mocha.js "tests/project-tools-test/backpack-{storage,search,ui,project,blocks,editor}.spec.js" --reporter dot`
from PXT for the source-based backpack suites. They transpile the relevant current
TypeScript in memory; they do not run a build, development server, live sign-in,
network download, or user program. Browser suites require Puppeteer's Chromium.
The storage harness uses the current store source and Chromium's real IndexedDB
on an intercepted test origin. It needs the already-used Puppeteer browser, not
fake-indexeddb or an additional dependency. All endpoint replies are synthetic;
no live backend, user account, or network download is involved.

Run the separate [real asset suite](backpack-assets.spec.js) with
`node node_modules/mocha/bin/mocha.js tests/project-tools-test/backpack-assets.spec.js --reporter dot`.
It requires existing, up-to-date PXT library/simulator and Blockly build output,
including the backpack and asset-field modules. It does **not** rebuild them.
After changing those production sources, stale build output is not evidence that
the changes pass. Do not use `gulp testprojecttools` for a no-build check: that task
rebuilds the shared library and webapp first.

- [backpack-storage.spec.js](backpack-storage.spec.js): dedicated endpoint envelopes
  and the production IndexedDB adapter. Covers metadata pagination, incomplete lists,
  code-only-on-Add, >64 KiB creates, ETag rename/delete, 200/204 handling, 401 logout,
  safe allowlisted errors, durable pending saves, lost ACK/idempotent retry after
  remote rename, independent guest promotion, account/target/token transitions,
  compare-and-swap cleanup against concurrent local edits, malformed-key recovery,
  missing content recovery, private previews, byte/schema validation, unavailable
  storage, and explicit-only legacy export/reset. It deliberately rejects use of
  the generic auth API helper, native localStorage, or preference-backed normal storage.
- [backpack-search.spec.js](backpack-search.spec.js): source-based indexing with the real
  Fuse.js dependency; cloud summary-only indexing, fuzzy names, local nested block types and values, captured labels,
  all extension references, multiple terms, stable ordering, malformed input and no
  indexing of binary assets or internal IDs. Recovery cards use only their safe names;
  local/cloud entries with identical keys remain distinct. No Blockly loaders or network calls.
- [backpack-ui.spec.js](backpack-ui.spec.js): current panel, real React, Fuse, validator,
  standalone LESS, focus and keyboard behavior; auth, package access and storage/import
  operations are mocked. Covers usable guest contents with/without an identity
  provider, the centered sign-in button, local/profile deletion, refresh/reopen, account
  changes, literal names/previews/source filenames, deduplicated source requirements,
  missing-only extension requirements and updates as packages change, import restrictions,
  the real shared delete modal and focus trap,
  optional prefilled Rename dialogs, Enter/Save/Cancel/Escape, rename validation/retry,
  live search and result counts, clear/Escape, filtered rename/delete focus, account
  resets, reindexing and a fixed search field above the scrolling list,
  named/unnamed trash-only recovery cards, valid neighbors, retry/cancel/focus and
  source-aware confirmation without injecting invalid preview/code/markup,
  grouped top-right pencil/trash icons and a bottom-right filled confirmation button,
  alignment with long names and RTL, themed hover/disabled button states and text contrast,
  account changes, confirmation/retry/focus, quiet add/delete/rename outcomes,
  metadata-only cloud cards, lazy private-preview intersection and object-URL
  reclamation on account changes, and explicit legacy maintenance confirmation,
  mobile overflow/touch sizes and theme/forced-color focus. This suite does not
  install extensions or exercise the source-file popup itself.
- [backpack-editor.spec.js](backpack-editor.spec.js): extracts the current Blocks
  editor integration methods into a source-transpiled fixture. Covers guest and
  signed-in context saves without blocking sign-in, same-ID retries, editor guards,
  account changes during preview/save and captured import-host validity. Storage,
  serialization and project import are stubbed at their tested module boundaries.
- [backpack-preview.spec.js](backpack-preview.spec.js): source-based preview capture
  with real Blockly SVG cleanup and PNG rasterization. Checks 2× pixels, size-budget
  fallback, source immutability, following-block exclusion and optional-preview
  failure cleanup. Requires the built PXT library for the canvas encoder.
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

1. **IndexedDB and dedicated sync.** Guests can save, insert and delete without
  signing in. The `pxt-backpack` database has an `items` object store keyed by
  `[namespace, key]`, with a namespace index. Namespaces are JSON arrays of
  `[target, "guest", ""]` or `[target, "user", userId]`. Each record has its own
  serialized payload; writes resolve only on transaction completion. No native
  localStorage/preference payload writes or memory fallback are allowed. Guest
  uploads acquire an owner claim before sending; claimed entries are hidden from
  guests and other users. Each successful upload conditionally deletes only its
  own unchanged local record. A conflict or invalid guest must not block others.
  Lost ACKs retain pending named rows and **Retry sync** uses the same original
  UUID/body; a later remote rename survives. Signed-in saves must commit locally
  before upload. Verify reload durability, quota/transaction abort errors, and
  another-tab edits during upload. Reopen retries pending uploads independently;
  entries older than 24 hours since first attempt require a fresh capture.
  Sign-out/account/target changes must hide previous-user entries and discard late
  responses. Never use preferences as an outage fallback.
2. **Limits and isolation.** API defaults: **50 entries per target**, **512 KiB
  UTF-8 code**, **64 KiB metadata**, **128 KiB decoded PNG**, **1 MiB request/page**,
  **50 MiB account total**. The server enforces effective quotas. Captured images
  retain the conservative 64,000-character raster budget and density fallback;
  the unchanged Blockly serializer/importer has its own 100,000-character bound.
  Names stay 1–100 characters without controls; dependencies stay portable and
  bounded, and optional `projectBlocks` contains filenames, never source code.
  Check multibyte text boundaries, malformed summaries, recovery trash, and no
  changes to other targets or unrelated preferences.
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
6. **Optional names.** Saving uses the automatic block name without prompting.
  **Rename** opens a modal with that name selected; Enter or **Save** updates only
  the Backpack label. Cancel, Close and Escape preserve it and restore button focus.
  Blank/control-character names are rejected and input is limited to 100 characters.
  Errors keep the draft available for retry. Check guest persistence after reload
  and signed-in changes on another device; block data, preview and requirements
  must stay unchanged. No routine success message is shown.
7. **Local or synced deletion.** Delete opens a modal asking whether to remove the
  item **in this browser** for guests or **on all devices** when signed in.
  Cancel/Close/Escape preserves it and returns focus without closing the panel.
  During a pending/failed request, the entry remains; errors stay in the modal for
  retry. The background is hidden from screen readers and focus stays in the modal.
  Routine add/delete progress, success and cancellation text is not shown in the panel.
  After acknowledgement, focus goes to the next/previous entry or the panel when
  empty. Reopen in another tab/browser to verify removal. Deleting a backpack
   entry does not remove copies already inserted into projects.

## Dedicated Backpack staging handoff

No frontend suite is a substitute for the actual HTTP handler/infrastructure test.
The backend integration suite runs the actual PXT XHR client, IndexedDB and Fuse
against local HTTP and the real Backpack Cosmos class with an SDK-level fake.
It does not use real cloud credentials or establish cross-device Azure behavior.

- Public storage adapter: `createBackpackLocalStorage(IDBFactory)` returns
  `BackpackLocalStorage`; `listAsync(namespace)` and atomic
  `changeAsync(namespace, key, expected, next)` use actual transaction completion.
  `BackpackLocalRecord` and `backpackLocalNamespace(target, userId?)` describe records.
  These exports live in [backpack.ts](../../webapp/src/backpack.ts); no test-only global hooks.
  [backpackStorage.ts](../../webapp/src/backpackStorage.ts) also re-exports this public adapter boundary.
- Transport injection: supply the existing `pxt.Util.requestAsync` boundary, not
  `AuthClient.apiAsync`; retain `allowHttpErrors`, credentials, captured authorization,
  and target headers. Binary previews use `window.fetch` and `AbortSignal` separately.
- Metadata types: `BackpackSummary`, `BackpackLimits`, `BackpackEntry`, `BackpackState`.
  Cloud entries carry `summary`, not an `item` with invented code. `complete` is false
  for interrupted pagination. `getBackpackItems()` now returns only valid local bodies;
  use `importBackpackEntryAsync(entry, headerId)` for card-based Add.
- Existing capture `saveBackpackItemAsync` and body import `importBackpackItemAsync`
  signatures remain. Rename accepts an optional observed `BackpackEntry` as its third
  argument to preserve a dialog's ETag. `retryBackpackEntryAsync` retries one pending
  record, and `getBackpackPreviewAsync` returns a private Blob owned by the caller.
- Verify three pages of metadata, a later-page search match, no content before Add,
  lazy PNG requests and revoked object URLs. Force missing content and confirm trash
  remains available and refresh can recover the card.
- Force PUT 413/409/503, dropped ACK, ID collision, rename/delete 412, expired create
  retry, blocked/aborted IndexedDB, account changes during all requests, and independent
  promotion with good/bad/conflicting neighbors. A 2xx create must correspond to a
  committed backend entry; a local transaction request succeeding is not an ACK.
  The backend now stores each complete capture in a single Cosmos record. A failed
  atomic save leaves either no record or the committed record, never a partial
  server upload; pending recovery lives in the client's IndexedDB.
- Test **Old Backpack data… → Export old data / Cancel / Clear old Backpack data**.
  Only these explicit actions may read/remove the legacy preference. No reset endpoint,
  automatic migration, unrelated settings rewrite, or preference fallback is added.
- No new dependency is required. Chromium is already required by the UI suite and
  is now also required by the storage suite. Capture/preview/block/project suites
  remain separate and should be included in the full regression run.