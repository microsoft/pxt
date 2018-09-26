# Extension Versioning

When someone references your extension from the web UI they will get
a specific version.

If you have any tags, PXT will pick the one with
the highest [Semantic Version](http://semver.org) precedence (the biggest version
number). Thus, it's good to have tags like `v0.0.0`, `v0.1.7` etc.

If there are no tags, PXT will pick the latest commit from the default branch
(usually `master`).

In both cases, the specific version is hard-coded into the user's extension. The version tag is set in the [pxt.json](/extensions/pxt-json) for the extension:

```typescript-ignore
{
    "name": "neopixel",
    "version": "0.3.10",
    ...
}
```

You can use `pxt bump` to bump version of an extension. It will `git pull`, update the patch
version level (but will ask you for an override), create a git tag and push.

## Loading a previous extension version

If an older user project is incompatible with the current version of the editor, the editor will prompt the user asking to take a certain load. These optional actions are:

1. **Try to fix**: The project is upgraded to the current version of the editor if it's compatible with the editor's current core API. An upgrade of any required extensions is attempted also. A failure to upgrade will  prompt the user again but only with options **2** and **3**.

2. **Ignore errors and load**: The project and/or its extensions are loaded anyway. The user must resolve any incompatibilty problems with the code either in the project or loaded extensions.

3. **Go to the old editor**: The project is loaded in a previous version of the editor that supports both the project and extension versions.

## Extension updates

To update, the user has to take explicit action (currently, remove and re-add the extension using the editor).

## Forking extensions

Be aware that if you just fork an existing extension, the **fork won't show up in search**.
You have to create a new repo.