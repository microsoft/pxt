# pxt-bump Manual Page

### @description Bumps the current version number

Bumps the version number of the extension.

```
pxt bump [--update] [--upload] [--version <major|minor|patch|semver>] [--pr] [--nopr]
```

## Options

### --update

Updates the pxt-core dependency version to the latest tag.

### --upload

Uploads the target upon bumping

### --version

Which part of the version to bump, or a complete version number to assign. Defaults to 'patch'

### --pr

Bump via pull request rather than direct push

### --nopr

Bump via direct push rather than pull request (overrides --pr)

## See Also

[pxt](/cli) tool
