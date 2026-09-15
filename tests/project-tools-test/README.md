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
  compact bubble animation, persistent options, keyboard focus and dismissal,
  the 1199/1200px strip breakpoint, and preserving a mounted draft. Small-desktop
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
  not the controls. It covers legacy notes, named-board operations, independent
  images/text/undo, confirmed deletion and last-board protection, save errors/retry,
  all 16 colors on mobile and footer spacing.
  Contrast checks use the production stylesheet order (shared menu styles load
  after project-tools) and the actual theme manager. They check icons, text and
  keyboard focus through idle/hover/pressed/expanded states on mobile and desktop,
  plus system forced colors. Light/dark regression palettes and shared high
  contrast always run. With the sibling Arcade checkout (or `PXT_ARCADE_PATH`),
  every Arcade color theme and its override CSS is included automatically.

Bitmap/schema checks and the startup experiment guard are also covered by
[the editor suite](../pxt-editor-test/editorrunner.ts), run with `gulp testpxteditor`.
See the [feature notes](../../docs/project-tools.md) for manual UI/privacy checks.