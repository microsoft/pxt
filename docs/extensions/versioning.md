# Package Versioning

When someone references your package from the web UI they will get
a specific version.

If you have any tags, PXT will pick the one with
the highest [Semantic Version](http://semver.org) precedence (the biggest version
number). Thus, it's good to have tags like `v0.0.0`, `v0.1.7` etc.

If there are no tags, PXT will pick the latest commit from the default branch
(usually `master`).

In both cases, the specific version is hard-coded into the user's package. The version tag is set in the [pxt.json](/extensions/pxt-json) for the package:

```typescript-ignore
{
    "name": "neopixel",
    "version": "0.3.10",
    ...
}
```

You can use `pxt bump` to bump version of an extension. It will `git pull`, update the patch
version level (but will ask you for an override), create a git tag and push.

## Package updates

To update, the user has to take explicit action (currently, remove and re-add the package using the editor).

## Forking packages

Be aware that if you just fork an existing package, the **fork won't show up in search**.
You have to create a new repo.