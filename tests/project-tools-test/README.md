# Project tools tests

Run `gulp testprojecttools` from PXT. It rebuilds the shared library and webapp
modules before running the tests. The task is included in `gulp test`.

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
  the 991px breakpoint, and preserving a mounted draft. It compiles the production
  LESS with test theme variables and checks RTL, reduced-motion behavior, banner
  offsets, ellipsis alignment, speech-bubble pointers, and panel dismissal via
  the ellipsis, outside controls, keyboard focus and the simulator iframe.
  The whiteboard is stubbed; no development server is needed. Puppeteer's browser
  must be installed.
- [whiteboard.spec.js](whiteboard.spec.js) loads the actual image editor, reducer,
  whiteboard controller and header menu. Storage and game-asset access are mocked,
  not the controls. It covers legacy notes, named-board operations, independent
  images/text/undo, confirmed deletion and last-board protection, save errors/retry,
  all 16 colors on mobile and footer spacing.

Bitmap/schema checks and the startup experiment guard are also covered by
[the editor suite](../pxt-editor-test/editorrunner.ts), run with `gulp testpxteditor`.
See the [feature notes](../../docs/project-tools.md) for manual UI/privacy checks.