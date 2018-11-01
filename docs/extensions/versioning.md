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

## Resolving incompatibile versions

If an extension version used by a project isn't current, errors might occur when the editor trys to load the project. Extension versions used by the project may be incompatible with the current editor. If errors occur in an extension when the editor trys to load a project, the user is prompted to have the edtior attempt an action to try and resolve them. These actions are:

1. **Try to fix**: The extentions used by the project are upgraded to their current versions and the editor attempts to reload the project. If any errors are found again, the user is prompted to try a load action again but can only choose from options **2** or **3**.

2. **Ignore errors and load**: The project and its extensions are loaded anyway. The user must resolve any incompatibilty problems with the project and extensions.

3. **Go to the old editor**: This option only appears if the project was created in a previous version of the editor and if the editor is in a web browser. With this action, the project is loaded with an older editor version that matches the project version. This will restore the conditions of the editor environment that existed when the project was last saved.

## Extension updates

To update, the user has to take explicit action (currently, remove and re-add the extension using the editor).

## Forking extensions

Be aware that if you just fork an existing extension, the **fork won't show up in search**.
You have to create a new repo.

## Freezing extensions

It's possible to freeze, or lock, an approved extension to a particular tag in GitHub based on editor major version. This is useful in a servicing scenario where an older (incompatible) editor is kept online in parallel with a new editor.
The editor author can run ``pxt testghpkgs`` to generate the list of current extensions and tags and save them in the ``pxtargetconfig.json`` to freeze those versions*.

```
{
    "packages": {
        "releases": {
            "v0": [
                company/project#v0.0.1
            ]
        }
}
```

\* Extensions are denoted as `packages` in the JSON.
