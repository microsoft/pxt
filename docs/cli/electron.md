# pxt-electron Manual Page

### @description Electron-related operations

Performs the specified Electron-related subcommand.

```
pxt electron <subcommand> [flags]
```

## Subcommands

### `init` Subcommand
Prepares the PXT target in the current directory for use with `pxt electron run`.

```
pxt electron init [--product path/to/product.json] [--appsrc path/to/pxt_electron_shell]
```

### `run` Subcommand
Runs the target from the current directory inside the PXT Electron app. Requires to have previously run `pxt electron init` for the current target.

```
pxt electron run [--appsrc path/to/pxt_electron_shell]
```

### `package` Subcommand
Packages the full PXT Electron app using the target from the current directory.

To also build the distributable (.exe installer on Windows, .zip app bundle on Mac OS), use the `--installer` flag.

To use a published target from NPM instead of the target in the current directory, use the `--release` flag.

```
pxt electron package [--product path/to/product.json] [--appsrc path/to/pxt_electron_shell] [--installer] [--release target[@version]]
```

## Flags

### `--product` Flag
Specifies the path to the product.json file to use. Use this flag if you need a custom product.json. To use the target's default product.json, this flag is not needed.

```
[--product path/to/product.json]
[-p path/to/product.json]
```

### `--appsrc` Flag
Specifies the path to the root of the PXT Electron app source code. Defaults to `../pxt/electron`.

If your target's repo and the pxt-core repo are in the same directory, you don't need to specify this.

```
[--appsrc path/to/pxt_electron_shell]
[-a path/to/pxt_electron_shell]
```

### `--installer` Flag (`pxt electron package` only)
When packaging the app, using this flag will also generate the distributable for the Electron app (.exe installer on Windows, .zip app bundle on Mac OS).

```
[--installer]
[-i]
```

### `--release` Flag (`pxt electron package` only)
All `pxt electron` commands default to using the local target from the current directory.

When packaging the app, however, you can choose to use a target from a published NPM package instead of your local repo.

```
[--release target[@version]]
[-r target[@version]]
```