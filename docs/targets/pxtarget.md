# pxtarget.json Manual Page

A PXT target is described by a `pxtarget.json` JSON file.
Here are two examples of `pxtarget.json` files, one simple and one more complex:
* https://github.com/Microsoft/pxt-sample/blob/master/pxtarget.json
* https://github.com/Microsoft/pxt-microbit/blob/master/pxtarget.json

The JSON file `pxtarget.json` is described at the top-level by the interfaces `TargetBundle`
and `AppTarget`, shown below. 
Fields labelled as "DERIVED" in the comments are populated by PXT from other sources,
as indicated. All other fields below are user-supplied. Optional fields have a "?" after their name. 

All PXT targets/packages also must supply an NPM [package.json](https://docs.npmjs.com/files/package.json)
file, which describes the versioning, dependency and resources required to build the target/package.
You can find examples for pxt-sample and pxt-microbit here:
* https://github.com/Microsoft/pxt-sample/blob/master/package.json
* https://github.com/Microsoft/pxt-microbit/blob/master/package.json

## TargetBundle

The interface `TargetBundle` describes the PXT packages that come bundled 
with the target (as opposed to being pulled from the web), as well as the semantic
version of the target:
```typescript
    interface TargetBundle extends AppTarget {
        versions: TargetVersions;       // DERIVED: defines the semantic versioning for the target
        bundleddirs: string[];          // packages to be bundled into web app (libs/*)
    }
```

### versions: TargetVersions

PXT uses [semantic versioning](http://semver.org/) of its targets and packages.  The TargetVersions
interface has two relevant fields that are populated as specified below:
```typescript
    interface TargetVersions {
        target: string; // equal to version field in "package.json"
        pxt: string;    // equal to version field in "package.json" or "node_modules/pxt-core/package.json"
    }
```

### bundleddirs: string[]

A target can use many packages in addition to the required "corepkg". To 
ensure that a package is bundled into the web app, you must include it in this list. For 
example in http://github.com/microsoft/pxt-microbit/blob/master, we see:
```typescript
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
via an "add package" request by the end user).

## AppTarget

Most of the user-defined fields for `pxttarget.json` are described by the interface `AppTarget`.
```typescript
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
        serial?: AppSerial;
        compileService?: TargetCompileService;
        analytics?: AppAnalytics;
    }
```

### corepkg: string

A target must have a package under the libs/ directory where the core APIs for the target reside.
Also, the core should always be bundled with the web app, as shown below:
```typescript
    "corepkg": "core",
    "bundleddirs": [
        "libs/core"
    ]
```

### compile: CompileTarget

PXT supports compilation to both JavaScript and ARM machine code (native). Web-only targets
will not need the native compilation path.

```typescript
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
```typescript
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
        "simAnimationExit": "rotate out",
        "disableBlockIcons": true
    }
```

### cloud?: AppCloud

PXT has a cloud backend that provides a set of services to the web app.  The services are configured using
the `cloud` field in pxttarget.json, defined by the `AppCloud` interface:

```typescript
    interface AppCloud {
        workspaces?: boolean;         // 
        packages?: boolean;
        publishing?: boolean;
        sharing?: boolean;            // enable cloud-based anonymous sharing of projects
        importing?: boolean;          // import url dialog
        embedding?: boolean;
        preferredPackages?: string[]; // list of company/project(#tag) of packages
        githubPackages?: boolean;     // allow searching github for packages
    }
```

For example in the pxttarget.json for http://github.com/microsoft/pxt-microbit, we see:
```typescript
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

### runtime?: RuntimeOptions;

### serial?: AppSerial;

### compileService?: TargetCompileService;

### analytics?: AppAnalytics;