# Project tools bubbles, private whiteboards and backpack

This is a focused port of the tabbed/resizable documentation idea from
[PR #10888](https://github.com/microsoft/pxt/pull/10888), rebuilt on current PXT.
It does not include the prototype's chat component, AI integration, build watcher
changes or old layout overrides.

## Enable

Arcade enables this feature by default through `appTheme.projectTools: true` in
its target configuration, including target uploads. No experiment setting is
needed and the default does not trigger an experiments banner on its own.

On other asset-editor targets, open **Settings → About → Experiments**
and enable **Project tools bubbles**, then reload. For a local preview, add
`?projecttools=1` to the editor URL. Targets may also opt in with the
`appTheme.projectTools` flag. Without a target flag, experiment or preview query,
existing sidedocs behavior is unchanged. Experiment startup never overwrites
the target's authored default.

The feature is hidden on the home screen, in sandbox/locked editors, for temporary
projects and when there is no image palette. Other targets can explicitly list
`projectTools` in their experiments.

## Interaction

- **Documentation**, **Whiteboard** and **Backpack** each have a bubble; the bubbles are the tabs.
- Default widths follow the target's legacy sidedocs variables and breakpoints,
  rather than a fixed 600px panel. On large desktops, the bubble strip counts
  toward that width budget to preserve coding space. In Arcade, the panel starts
  at 344px on smaller desktops (352px including its outer gutter), and 368px on
  large monitors (448px including the strip), 352px on tablets and 288px on phones.
  Untouched widths adapt when the
  viewport changes; manual resizing overrides the default. Dimensions remain
  capped to the screen and the panel can be enlarged whenever needed.
- The **…** bubble is always available to hide or reveal the other bubbles. They
  default to expanded on desktop (992px and wider) and collapsed on tablets and
  phones (991px and narrower), without opening a panel or moving keyboard focus.
  Smaller desktops still use the horizontal strip above the panel; large desktops
  (1200px and wider) use a vertical strip below **…**. Bubbles slide from the
  ellipsis in 160ms. Changing between the two desktop layouts preserves an explicit
  hide/reveal choice; crossing the tablet breakpoint applies that layout's default.
  The bubbles remain visible when
  selecting, using, switching or closing a panel, so the active bubble can be
  pressed again to close it. **…** retracts the bubbles and hides the open panel.
  Unless pinned, clicking outside the tools or tabbing away dismisses the panel,
  including clicks in the simulator. Desktop bubbles remain available; tablet and
  phone bubbles retract. Interacting inside any
  panel (including the documentation iframe) keeps it open. Motion is mirrored in RTL and disabled for reduced-motion
  preferences. Resizing and hiding bubbles never reset the notes or pin setting.
- The bubbles and panel follow the editor's notification-banner offset, including
  the **Experiments enabled.** banner; dismissing it restores their normal position.
- A speech-bubble pointer connects the open panel to its active bubble. In either
  layout, the pointer targets **…** instead if help opens while the options are
  tucked away. Pressing **…** then closes that panel rather than expanding the options.
- Select a bubble to open its panel, select another to switch, and select the
  active bubble again to collapse it. Escape also collapses and returns focus.
- Use the pin icon in any header to keep the tools open while interacting elsewhere.
  A filled upright pin and a border indicate enabled; an outlined angled pin
  indicates disabled. Tooltips and an accessible toggle label describe the control.
  **Collapse**, Escape, the
  active bubble and **…** still close the panel without clearing the pin. Reopening
  or switching tabs retains the setting for the current project view.
- Documentation that automatically opens with a homepage example/project (a
  configured documentation page or auto-open README) starts pinned. Ordinary block
  help does not force pinning, and reloading the current project keeps a manual
  unpin choice. The pin is UI state, not shared project content.
- Up/Down and Home/End navigate the vertical bubble tabs. Horizontal options use
  Left/Right and Home/End, then Enter/Space to select. Collapsing a panel
  returns focus to its bubble if visible, otherwise **…**. Escape closes the
  panel first; another Escape from its bubble retracts the options.
- Subtle dotted grips mark the side and bottom resize edges. Drag the side to
  change width (mirrored in RTL), or the bottom to change height. Keyboard users
  can use Left/Right for width, Up/Down for height, and Shift for larger steps.
  Home selects the minimum; End on the bottom grip restores the full available
  height. Both dimensions are retained across tab switches and collapse/reopen,
  and height is capped to fit below the header and above the footer. Smaller
  desktops keep both grips and desktop header/footer spacing even with horizontal
  bubbles. On tablets and phones (991px or narrower), the width grip is hidden;
  the bottom grip still adjusts height. Initially panels extend to just above the
  corresponding editor footer. The whiteboard's palette
  scrolls independently, so all 16 colors remain available even on short screens.
- Existing block help, reference, built-in keyboard help and markdown entry points
  open Documentation. Asking for the same topic again selects Documentation even
  when Whiteboard is currently active. Collapsing does not reload the docs iframe.
- Use the **Whiteboards** dropdown in the whiteboard header to select a board,
  **Rename whiteboard**, or create a **New whiteboard**. A project can have up to
  eight boards with unique, single-line names of up to 64 characters. Each board
  has its own 160 × 120 drawing, text notes and undo history; the last selected
  board is remembered. Undo history is kept during switching, not across reloads.
- When there is more than one board, **Delete whiteboard** asks for confirmation
  naming the board. **Cancel** or Escape leaves it unchanged. Confirming **Delete**
  removes that board's drawing and notes, saves the remaining collection and
  switches to a neighboring board. At least one board is always kept; deletion
  cannot be undone with the drawing editor's Undo button.
- A project without notes starts with a blank **Whiteboard 1**; opening the panel
  does not save metadata until the user edits it. Each board uses the existing single-image editor with a
  separate Redux store and is never registered as a game asset. The canvas sits
  directly below the privacy label without a separate Sketch/Clear drawing row.
  Image resizing is not supported.

The short privacy label is **“Private project notes: not included when sharing”**.
There is no routine saving/saved text. Save errors display a Retry action.

## Backpack

Keep reusable block containers without signing in: they are saved in this
browser's local storage, separately for each MakeCode target. A centered button at
the top offers **Sign in to save your backpack across browsers**. Signing in
adds local snippets to the profile when the backpack next opens or saves; local
copies are removed only after the server confirms them. Failed uploads keep the
local copies, and existing profile snippets are never silently overwritten.

In an editable Blocks project, right-click or hold a container
(such as an event, loop, if block or function definition) and choose **Add to
Backpack**. Alternatively, drag it onto the Backpack bubble or panel. Hovering
over the bubble for 500ms opens the panel without taking focus; the **…** bubble
also accepts the drag when the other bubbles are hidden.

Saving copies the container's contents, referenced Blockly function definitions
and assets. It does not include following siblings or remove the original blocks.
Each entry lists its required extensions. **Add to project** asks permission
before installing missing extensions, checks conflicts, preserves current code
before reloading, and inserts the snippet as one undo group. It does not silently
replace existing extensions or upgrade an installed version of the same repository.

Blocks defined in the original project's own TypeScript files need those APIs in
the destination too. The backpack records their filenames, not their source code.
If a required block is missing, **Project code is required** names the source files
and stops insertion. Copy the code into the destination or publish it as an
extension before trying again.

**Delete** opens a confirmation modal: it removes the entry from this browser when
signed out, or from the profile after server acknowledgement when signed in.
Cancel or Escape closes the modal without deleting. Failures remain in the modal
for retry; routine add/delete progress and success messages are not shown in the panel.
Copies already inserted in projects remain unchanged. Reopen the panel to receive
changes from other tabs or, when signed in, other browsers. Failed saves offer
retry; sign-out/account changes hide the previous account's items without copying
them into guest storage. Clearing browser storage removes unsynced local snippets.

The backpack supports up to 50 items per target. The 500,000-character storage
limit applies per target locally and across targets in the profile. Each snippet
is limited to 100,000 code characters, with an optional bounded PNG preview and
portable extension references. Blocked/full local storage reports a save error
instead of silently using memory. Backpack contents are not added to project shares
or exports unless explicitly inserted into that project's code. Backend sync is
covered with a simulated authenticated API, not a live cross-device account test.
See [the test guide](../tests/project-tools-test/README.md) for limits and manual checks.

## Whiteboard storage and sharing boundary

Notes are stored in `Header.projectNotes`, not in `ScriptText`, asset collections,
JRES or the package manifest. `ProjectNotes` contains `whiteboards` and
`activeWhiteboardId`; each board has an ID, name, up to 4,096 text characters,
an optional base64 F4 image and its palette. Every board, name and ID is validated.
Image dimensions and encoded lengths are checked before decoding/allocating the bitmap.

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
The collection is saved as one snapshot, so switching boards does not race
independent writes that could drop another board's edits. Cloud conflict choices
apply to the entire saved collection.

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
  filtering, first-board initialization, bounded collections, add/rename operations,
  experiment availability, and the existing editor tests.
- `gulp testprojecttools`: real workspace/cloud modules with fake durable storage
  and authenticated API, both share paths, duplicate isolation, cloud round trips,
  in-flight edits, persistence failures/retry, and shortcut-owner tests. A
  Puppeteer component suite uses the production styles to cover compact
  animation (including RTL and reduced motion), persistent bubbles and repeated
  toggling, keyboard focus/dismissal, the tablet and large-desktop breakpoints, banner layout,
  centered launcher dots, panel-pointer alignment, outside/iframe dismissal and
  pin retention/automatic example defaults and mounted drafts. A real-image-editor browser suite covers the header menu,
  independent drawings/text/undo, retries, and mobile palette access/footer spacing.
- Local Arcade browser checks: separate bubbles, keyboard navigation and resizing,
  drawing/text persistence after collapse and reload, no game-asset registration,
  text undo isolation, exclusion from the actual project-file export, experiment
  off/on behavior, and short/narrow viewport spacing. Compact behavior is checked
  at 390, 768, 826, 991, 992, 1024 and 1199px; vertical desktop bubbles at 1200 and 1366px.

Cloud tests mock the API; no notes were publicly published and no live account
sync was performed. Cross-device account verification and a full mobile/screen
reader pass remain useful pre-release checks. The local docs renderer can still
surface pre-existing snippet-renderer diagnostics; its sandbox and message
protocol have not changed.