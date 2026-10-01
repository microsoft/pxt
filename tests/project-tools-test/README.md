# Project tools tests

Run from PXT, sequentially:

```bash
node node_modules/gulp/bin/gulp.js testprojecttools
node node_modules/gulp/bin/gulp.js testpxteditor
```

`testprojecttools` rebuilds pxtlib/webapp and is included in `gulp test`. Asset tests
also need fresh Blockly/simulator output; run a full `gulp` build after changing
those modules. Browser tests require Puppeteer's Chromium, not a development server.

- Storage suites cover persistence, account isolation and sharing privacy.
- Project/clipboard suites cover dependency consent, conflicts and editor integration.
- Block/asset suites exercise serialization, pixels and undo; drag tests cover
  host-provided targets, dwell and cleanup.
- UI/launcher/whiteboard suites cover panel interaction, accessibility,
  native button/tab behavior and feature-control appearance.

Shared browser and source-loading helpers live in [browser.js](browser.js) and
[source.js](source.js). Network and account calls are mocked. Before release,
manually check cross-device sync, keyboard/touch input and screen readers.
See [feature usage](../../docs/project-tools.md).