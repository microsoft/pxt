# Project tools tests

Run from PXT, sequentially:

```bash
node node_modules/gulp/bin/gulp.js testprojecttools
node node_modules/gulp/bin/gulp.js testpxteditor
```

`testprojecttools` rebuilds pxtlib/webapp and is included in `gulp test`. Asset tests
also need fresh Blockly/simulator output; run a full `gulp` build after changing
those modules. Browser tests require Puppeteer's Chromium, not a development server.

- Storage/auth suites own persistence, account isolation and sharing privacy.
- Project/clipboard suites own dependency consent, conflicts and editor integration.
- Block/asset/preview suites exercise real serialization, pixels and undo.
- UI/launcher/whiteboard/keyboard suites own user interaction and accessibility.

Test shared behavior once, with representative cases rather than viewport/theme
or failure-stage matrices. Use [browser.js](browser.js), await actual effects and
transactions, and unmount before closing pages. Network/account boundaries are
mocked; verify real cross-device sync, keyboard/touch and screen-reader behavior
before release. See [feature usage](../../docs/project-tools.md).