# pxtarget.json Manual Page

A PXT target is described by a `pxtarget.json` JSON file.
Here are two examples of `pxtarget.json` files, one simple and one more complex:
* https://github.com/Microsoft/pxt-sample/blob/master/pxtarget.json
* https://github.com/Microsoft/pxt-microbit/blob/master/pxtarget.json

The JSON file `pxtarget.json` is described at the top-level by the interfaces `TargetBundle`
and `AppTarget`, shown below. 
Fields labelled as "DERIVED" in the comments are populated by PXT from other sources,
as indicated. All other fields below are user-supplied. Optional fields have a "?" after their name. 

All PXT targets also must supply an NPM [package.json](https://docs.npmjs.com/files/package.json)
file, which describes the versioning, dependency and resources required to build the target.
You can find examples for pxt-sample and pxt-microbit here:
* https://github.com/Microsoft/pxt-sample/blob/master/package.json
* https://github.com/Microsoft/pxt-microbit/blob/master/package.json

Here's more about [creating a target](/target-creation)

## TargetBundle

The interface `TargetBundle` describes the PXT packages that come bundled 
with the target (as opposed to being pulled from the web), as well as the semantic
version of the target:
```typescript-ignore
    interface TargetBundle extends AppTarget {
        versions: TargetVersions;       // DERIVED: defines the semantic versioning for the target
        bundleddirs: string[];          // packages to be bundled into web app (libs/*)
    }
```

### versions: TargetVersions

PXT uses [semantic versioning](http://semver.org/) of its targets and packages.  The TargetVersions
interface has two relevant fields that are populated as specified below:
```typescript-ignore
    interface TargetVersions {
        target: string; // equal to version field in "package.json"
        pxt: string;    // equal to version field in "package.json" or "node_modules/pxt-core/package.json"
    }
```

### bundleddirs: string[]

A target can use many packages in addition to the required "corepkg". To 
ensure that an extension is bundled into the web app, you must include it in this list. For 
example in http://github.com/microsoft/pxt-microbit/blob/master, we see:
```typescript-ignore
    "bundleddirs": [
        "libs/core",
        "libs/radio",
        "libs/devices",
        "libs/bluetooth"
    ],
```
This ensures that the above four packages are compiled/bundled into the web app and delivered on the initial
download of the web app. Other packages for the micro:bit, such as http://github.com/microsoft/pxt-neopixel 
are not bundled and remain on github.com, where they are loaded as needed by the web app (usually 
via an "Extensions" request by the end user).

## AppTarget

Most of the user-defined fields for `pxttarget.json` are described by the interface `AppTarget`.
```typescript-ignore
    interface AppTarget {
        id: string;             // unique id: should match ^[a-z]+$; used in URLs and domain names
        name: string;           // friendly name (spaces allowed)
        corepkg: string;        // specifies the directory (under libs/) for target's core APIs
                                // such libraries also are known as packages. See section below. 
        compile: CompileTarget; // see sections below for description
        appTheme: AppTheme;     // see sections below for description 

        nickname?: string;      // Friendly id (should match ^[a-zA-Z]+$); used when generating files, 
                                // folders, etc. defaults to id
        platformid?: string;    // Used as search term in GitHub search for packages; defaults to id
        
        title?: string;         // for HTML TITLE tag
        description?: string;   // for HTML META Description

        cloud?: AppCloud;       // see sections below for descriptions of the rest of the fields
        simulator?: AppSimulator;
        runtime?: RuntimeOptions;
        compileService?: TargetCompileService;
    }
```

### corepkg: string

A target must have a core [package](/packages) under the libs/ directory 
where the core APIs for the target reside.
The core package should always be bundled with the web app, as shown below:
```typescript-ignore
    "corepkg": "core",
    "bundleddirs": [
        "libs/core"
    ]
```

### compile: CompileTarget

PXT supports compilation to both JavaScript and ARM machine code (native). Web-only targets
will not need the native compilation path.

```typescript-ignore
    interface CompileTarget {
        isNative: boolean;      // false -> JavaScript compilation only, for simulator
        hasHex: boolean;        // output binary file (implies isNative)
        nativeType?: string;    // currently only "thumb", though there is a prototype for AVR
  
        // output file options
        useUF2?: boolean;       // true -> output UF2 format (see https://github.com/Microsoft/uf2), false -> HEX file
        hexMimeType?: string;   // Mime type for hex files 
        driveName?: string;     // how will the device appear when plugged in via MSD?
        deployDrives?: string;  // partial name of drives where the HEX/UF2 file should be copied

        // code generation options
        floatingPoint?: boolean; // use floating point in JavaScript (default is 32-bit integers)
        taggedInts?: boolean;    // true -> use tagged integers in native (implies floatingPoint)
        shortPointers?: boolean; // true -> 16 bit pointers
        flashCodeAlign?: number; // defaults to 1k page size
        flashChecksumAddr?: number;  // where to store checksum of code

        // advanced debugging options
        boxDebug?: boolean;     // generate debugging code for boxing
        jsRefCounting?: boolean;// generate debugging in JS for reference counting scheme
        openocdScript?: string;
    }
```

### appTheme: AppTheme

PXT has a large number of options for controlling 
the [look and feel](/targets/theming) of a target.
Here is the appTheme from pxt-sample with some comments:
```typescript-ignore
    "appTheme": {
        // URLs to use for various components of the UI
        "logoUrl": "https://microsoft.github.io/pxt-sample/",
        "homeUrl": "https://microsoft.github.io/pxt-sample/",
        "privacyUrl": "https://go.microsoft.com/fwlink/?LinkId=521839",
        "termsOfUseUrl": "https://go.microsoft.com/fwlink/?LinkID=206977",
        "betaUrl": "https://makecode.com/",
        // populating the (?) menu
        "docMenu": [
            {
                "name": "About",
                "path": "/about"
            },
            {
                "name": "Docs",
                "path": "/docs"
            }
        ],
        // enable toolbox for both Blockly and JavaScript
        "coloredToolbox": true,
        "monacoToolbox": true,
        "invertedMenu": true,
        "simAnimationEnter": "rotate in",
        "simAnimationExit": "rotate out"
    }
```

### cloud?: AppCloud

PXT has a cloud backend that provides a set of services to the web app.  The services are configured using
the `cloud` field in pxttarget.json, defined by the `AppCloud` interface:

```typescript-ignore
    interface AppCloud {
        sharing?: boolean;      // enable anonymous sharing of projects via URL
        importing?: boolean;    // enable import of a previously shared project from 
                                // a URL (requires sharing? and publishing?)

        packages?: boolean;           // enabled loading of packages (from github)
        preferredPackages?: string[]; // list of company/project(#tag) of packages on github
        githubPackages?: boolean;     // enable user-specified term for searching github for packages
        
        // to be retired soon
        publishing?: boolean;   // must set true for importing? to work; no other purpose evident
        embedding?: boolean;
        
        // not currently supported
        workspaces?: boolean;
    }
```

For example in the pxttarget.json for http://github.com/microsoft/pxt-microbit, we see:
```typescript-ignore
    "cloud": {
        "workspace": false,
        "packages": true,
        "sharing": true,
        "publishing": true,
        "preferredPackages": [
            "Microsoft/pxt-neopixel"
        ],
        "githubPackages": true
    }
```

### simulator?: AppSimulator;

PXT provides a JavaScript-based simulation environment on the left side of the web
app (typically for physical computing devices like the micro:bit).  PXT uses the
term [board](/targets/board) to refer to the main physical computing device shown in the simulator.
Each target has one board (plus optional parts).

```typescript-ignore
    interface AppSimulator {
        // define aspects of physical computing device
        boardDefinition?: BoardDefinition;
        // if true, boardDefinition comes from board package
        dynamicBoardDefinition?: boolean;

        // running and code changes
        autoRun?: boolean;          // automatically run program after a change to its code
        stopOnChange?: boolean;     // stop execution when user changes code
        headless?: boolean;         // whether simulator should still run while collapsed
        
        // buttons and parts
        hideRestart?: boolean;      // hide the restart button 
        hideFullscreen?: boolean;   // hide the fullscreen button
        parts?: boolean;            // parts enabled?
        instructions?: boolean;     // generate step-by-step wiring instructions (Make button)

        // appearance
        aspectRatio?: number;       // width / height
        partsAspectRatio?: number;  // aspect ratio of the simulator when parts are displayed

        // miscellaneous
        trustedUrls?: string[];     // URLs that are allowed in simulator modal messages
    }
```

The `boardDefinition` can be also defined in the [core board package](/targets/board).

### runtime?: RuntimeOptions;

This severely misnamed option controls the available blocks in the Blockly editor:

```typescript-ignore
    interface RuntimeOptions {
        // control whether or not Blockly built-in categories appear
        mathBlocks?: boolean;       
        textBlocks?: boolean;
        listsBlocks?: boolean;
        variablesBlocks?: boolean;
        logicBlocks?: boolean;
        loopsBlocks?: boolean;

        // options specific to the special "on start" block
        onStartNamespace?: string; // default = loops
        onStartColor?: string;
        onStartWeight?: number;
        onStartUnDeletable?: boolean;
    }
```

### compileService?: TargetCompileService;

PXT provides a compile service for C/C++ code that may be included in a target/package.  
Currently, this compile service can be configured
to use either [yotta](https://www.mbed.com/en/platform/software/mbed-yotta/) 
or [platformio](http://platformio.org/).
PXT defaults to using local installs of yotta and platformio.
PXT expects to find the C/C++ sources on github.

```typescript-ignore
    interface TargetCompileService {
        buildEngine?: string;           // default is yotta, set to platformio
        // where are the sources
        githubCorePackage?: string;     // e.g. lancaster-university/microbit
        gittag: string;
        // yotta configuration
        yottaCorePackage?: string;      // name for PXT use
        yottaTarget?: string;           // name of yotta target to build
        yottaBinary?: string;           // name of yotta output file 
        yottaConfig?: any;              // additional config
        // platformio configuration
        platformioIni?: string[];       // define contents of platformio.ini file

        serviceId: string;
    }
```
