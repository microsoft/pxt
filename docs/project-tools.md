# Project tools bubbles (experiment)

This is a focused port of the tabbed/resizable documentation idea from
[PR #10888](https://github.com/microsoft/pxt/pull/10888), rebuilt on current PXT.
It does not include the prototype's chat component, AI integration, build watcher
changes or old layout overrides.

## Enable

In an asset-editor target such as Arcade, open **Settings → About → Experiments**
and enable **Project tools bubbles**, then reload. For a local preview, add
`?projecttools=1` to the editor URL. Targets may also opt in with the
`appTheme.projectTools` flag. Existing sidedocs behavior remains the default.

The feature is hidden on the home screen, in sandbox/locked editors, for temporary
projects and when there is no image palette. Other targets can explicitly list
`projectTools` in their experiments.

## Interaction

- **Documentation** and **Whiteboard** each have a bubble; the bubbles are the tabs.
- On small tablets and phones (991px wide or less), a single **…** bubble reveals
  the other bubbles with a 160ms slide out from behind it. They remain visible when
  selecting, using, switching or closing a panel, so the active bubble can be
  pressed again to close it. **…**, clicking outside the tools, or tabbing away
  retracts the bubbles and hides the open panel. Clicking outside also hides the
  panel on desktop, including clicks in the simulator. Interacting inside either
  panel (including the documentation iframe) keeps it open. Motion is mirrored in RTL and disabled for reduced-motion
  preferences. Widening the screen restores the separate bubbles without resetting notes.
- The bubbles and panel follow the editor's notification-banner offset, including
  the **Experiments enabled.** banner; dismissing it restores their normal position.
- A speech-bubble pointer connects the open panel to its active bubble. In compact
  mode, the pointer targets **…** instead if help opens while the options are
  tucked away. Pressing **…** then closes that panel rather than expanding the options.
- Select a bubble to open its panel, select the other to switch, and select the
  active bubble again to collapse it. Escape also collapses and returns focus.
- Up/Down and Home/End navigate the desktop bubble tabs. Compact options use
  Left/Right and Home/End, then Enter/Space to select. Collapsing a compact panel
  returns focus to its bubble if visible, otherwise **…**. Escape closes the
  panel first; another Escape from its bubble retracts the options.
- The panel can be resized using its edge, or Left/Right, Home/End on the keyboard
  resize control. The layout is mirrored in RTL and fits narrow screens.
- Existing block help, reference, built-in keyboard help and markdown entry points
  open Documentation. Asking for the same topic again selects Documentation even
  when Whiteboard is currently active. Collapsing does not reload the docs iframe.
- Whiteboard uses the existing single-image editor with a separate Redux store,
  a 160 × 120 sketch and a plain-text note field. It is not a game asset. The
  canvas sits directly below the privacy label without a separate Sketch/Clear
  drawing row. Multiple pages and image resizing are not part of this first version.

The short privacy label is **“Private project notes: not included when sharing”**.
There is no routine saving/saved text. Save errors display a Retry action.

## Storage and sharing boundary

Notes are stored in `Header.projectNotes`, not in `ScriptText`, asset collections,
JRES or the package manifest. The schema contains a version, up to 4,096 text
characters, an optional base64 F4 image and its palette. Image dimensions and
encoded lengths are checked before decoding/allocating the bitmap.

| Path | Notes included? |
| --- | --- |
| Browser/local project storage | Yes |
| Signed-in account project sync | Yes |
| Duplicate or conflict copy of your own project | Yes, as separate project data |
| Anonymous or persistent share request | No |
| GitHub source/asset commits | No |
| Project-file, PNG and compiled-source exports | No |
| Game assets / native program | No |

[The sharing filter](../webapp/src/projectNotes.ts) is deliberately separate from
the cloud local-only filter: adding notes to the latter would prevent account
sync. Both publish paths use the filtered header. File exports and GitHub use
project files, so notes never enter those paths.

Autosave is debounced, flushed when leaving the panel/project, and bound to the
original project ID. A failed persistent write stays an error rather than silently
falling back to memory. Existing workspace session ownership prevents saving over
a project opened by another tab. Cloud transfers do not acknowledge/overwrite
notes edited while the network request was in flight. Incoming same-project notes
replace a clean view; a dirty view offers a choice instead of silently overwriting.

Existing workspace/cloud account isolation and conflict-copy semantics still
apply. As with normal project saves, closing the browser before an asynchronous
write finishes cannot guarantee durability. Account sync must complete before
another device can receive notes.

## Image-editor isolation

Inline editors register scoped shortcut ownership. Typing, undo, delete and
clipboard operations in a notes field or code editor must not affect the sketch.
An asset/tile editor retains its own store and listeners while the whiteboard is
present. Gallery/input shortcut locks are released on teardown. Hidden whiteboard
tabs retain the draft/store but unmount the canvas and its global listeners.

## Validation

- `gulp testpxteditor`: schema validation, bitmap round trips, public-header
  filtering, experiment availability, and the existing editor tests.
- `gulp testprojecttools`: real workspace/cloud modules with fake durable storage
  and authenticated API, both share paths, duplicate isolation, cloud round trips,
  in-flight edits, persistence failures/retry, and shortcut-owner tests. A
  Puppeteer component suite uses the production styles to cover compact
  animation (including RTL and reduced motion), persistent bubbles and repeated
  toggling, keyboard focus/dismissal, the tablet breakpoint, banner layout,
  centered launcher dots, panel-pointer alignment, outside/iframe dismissal and
  mounted drafts.
- Local Arcade browser checks: separate bubbles, keyboard navigation and resizing,
  drawing/text persistence after collapse and reload, no game-asset registration,
  text undo isolation, exclusion from the actual project-file export, experiment
  off/on behavior, and short/narrow viewport spacing. Compact behavior is checked
  at 390, 768, 826 and 991px; separate desktop bubbles at 992 and 1366px.

Cloud tests mock the API; no notes were publicly published and no live account
sync was performed. Cross-device account verification and a full mobile/screen
reader pass remain useful pre-release checks. The local docs renderer can still
surface pre-existing snippet-renderer diagnostics; its sandbox and message
protocol have not changed.