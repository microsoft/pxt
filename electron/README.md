# PXT Electron app

Electron app wrapper for PXT targets.

## Prerequisites
This app has dependencies that have native components. These native components will need to be recompiled when you install them. To recompile them, you need the following: 
- [Python 2.x](https://www.python.org/downloads/) (__NOT 3.x__); make sure `python` is in your global Path
- (Windows only) Visual Studio; any of the newer versions will do (Community 2015 works fine)

## Getting started
Once you have the above prerequisites:
```
cd electron
npm install
```

## Running current target in Electron app (equivalent of `pxt serve`)
```
cd [target directory]
pxt electron init          <----- You only have to run this once (per target)
pxt electron run
```

> **NOTE 1:** Make sure you have built both pxt-core and your target before running this. **You must be able to successfully `pxt serve` your current target**, otherwise the app won't work.

> **NOTE 2:** Only one target can be initialized for Electron at a time. You will need `pxt electorn init` every time you try a different target. 

> **NOTE 3:** Because of the way native modules work, `pxt electron init` may break `pxt serve`.
Once you run `pxt electron init`, if you can't run `pxt serve` anymore, delete all node modules from your target and from pxt-core, and reinstall them.

> **NOTE 4:** Due to a bug in NPM 3 when linking packages, this functionality only works in NPM 2.
If you are using NPM 3, you can still package the app (see section below), but you won't be able to run your target in Electron on the fly - you'll need to re-package the app every time you make changes.

## Packaging the app
To package (build) the app for your current target, run:
```
cd [target directory]
pxt electron package
```

The packaged app will be in `[Target directory]/electron-out`.

> **NOTE 1:** Make sure you have built both pxt-core and your target before running this. **You must be able to successfully `pxt serve` your current target**, otherwise the app won't work.

> **NOTE 2:** You do not need to `pxt electron init` your current target to package the app.

> **NOTE 3:** Packaging the app undoes `pxt electron init`. This means you will need to re-run `pxt electron init` if you want to use `pxt electron run` again.

> **NOTE 4:** Use the `--installer` flag to also build the distributable artifact for the app (.exe installer on Windows, zipped app bundle on Mac).

You can also package the app for a published target instead of using your local target:
```
pxt electron package --release <Target NPM package name>[@<NPM package version>]
```

In this case, the packaged app will be in `[PXT repo]/electron/electron-out`.

# Contributing to / modifying the Electron app

## Dependencies structure
The Electron app uses a dual `package.json` structure.

### electron/package.json
This is the development package.json. Use this one for dev dependencies needed to work on the app. These dependencies won't be packaged in the Electron app.

### electron/src/package.json
This is the app package.json. Use this one for dependencies needed by the app.

#### Native dependencies
Some node modules have native components that need to be recompiled when you install them. These are compiled against a specific version of Node.
However, Electron apps bundle their own version of Node, which will most likely be different from the version you have installed on your machine.
For this reason, we have a helper script that rebuilds the native modules against the installed Electron version:
```
npm run rebuildnative
```

If you add a dependency that has native modules to either the app shell (`src/package.json`), to a target or to pxt-core, you may need to modify the `electron/dev_tools/rebuildnative.js` script.
In that script, we maintain a list of known native modules that we manually clean up. You will need to find where the module keeps its built native components, and add an entry to the `knownNativeModules` array.

For example, serialport, used by pxt-core, keeps its built components under `[serialport module root]/build/release`, so we added the following entry:
```
let knownNativeModules = [
    {
        packageName: "serialport",
        cleanDir: path.join("build", "release")
    }
];
```

## Debugging
**Before you can debug, you must have previously run `pxt electron package` or `pxt electron init` in the target directory.**

You can debug the following processes:
- Electron webview
- PXT web app running inside the webview
- Electron main process (main.js) / PXT CLI

### Electron webview
To debug the Electron webview using the Chrome dev tools, run:
```
cd [PXT root]/electron
npm start -- --debug-webview
```

The webview is only a wrapper around the webapp. This won't let you debug the webapp, but can be useful to debug messages to and from the webview.

### PXT webapp
To debug the PXT webapp for your packaged target using the Chrome dev tools, run:
```
cd [PXT root]/electron
npm start -- --debug-webapp
```

You can debug both the webview and the webapp at the same time, simply use both `-w` and `-a`.

### Electron main process and PXT CLI
You can debug the app shell using the VS Code debugger. To do this, you need to open the `electron` directory in VS Code - you cannot debug this if you open the pxt repo root directory.
Once you have the `electron` directory open in VS Code, launch the debug configuration "Debug main.js" (hit F5, select "Node" as the debugger, select the debug configuration, and hit F5 again).

Put breakpoints in the following files:
- `[PXT root]/electron/src/main.js`
- (NPM 3+) `electron/src/node_modules/pxt-core/built/*`
- (NPM 2) `electron/src/node_modules/pxt-microbit/node_modules/pxt-core/built/*`

You can also debug the webview and / or the webapp at the same time (using the Chrome dev tools). To do this, go to the debug configuration in launch.json and add `-w` and / or `-a` to the `args` array:
```
...
    {
        "name": "Debug main.js",
        ...
        "args": [
            "--npm-start"
            "-a",
            "-w"
        ],
        ...
    },
```

## Code of conduct
This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
