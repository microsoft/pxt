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
- Block/asset suites exercise serialization, pixels and undo.
- UI/launcher/whiteboard suites cover representative interaction and accessibility.

Test shared behavior once, with representative cases rather than viewport/theme
or failure-stage matrices. Use [browser.js](browser.js), await actual effects and
transactions, and unmount before closing pages. Network/account boundaries are
mocked; check cross-device sync, keyboard/touch and screen readers manually
before release. See [feature usage](../../docs/project-tools.md).