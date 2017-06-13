# pxttarget.json Manual Page

The file `pxttarget.json` is described at the top-level by the interfaces `TargetBundle` and `AppTarget`,
described below. Fields labelled as "DERIVED" in the comments below are populated by PXT from other sources,
as indicated. All other fields below are user-supplied. Optional fields have a "?" after their name. 

The `TargetBundle` describes PXT packages that come bundled wth the target (as opposed to being pulled
from the web):
```typescript
    interface TargetBundle extends AppTarget {
        versions: TargetVersions;       // DERIVED: defines the semantic versioning for the target
        bundleddirs: string[];          // packages to be bundled into web app (libs/*)
    }
```
Most of the user-defined fields for `pxttarget.json` are found in `AppTarget`:
```typescript
    interface AppTarget {
        id: string;          // Has to match ^[a-z]+$; used in URLs and domain names
        nickname?: string;   // Friendly id (should match ^[a-zA-Z]+$); used when generating files, 
                             // folders, etc. defaults to id
        platformid?: string; // Used as search term in GitHub search for packages; defaults to id

        name: string;        // friendly name (spaces allowed)
        title?: string;      // for HTML TITLE tag
        description?: string;// for HTML META Description

        corepkg: string;     // every target must specify a directory where their core APIs are under libs/
                             // such libraries also are known as packages

        appTheme: AppTheme;


        compile: ts.pxtc.CompileTarget;

        blocksprj: ProjectTemplate;
        tsprj: ProjectTemplate;


        cloud?: AppCloud;
        simulator?: AppSimulator;
        runtime?: RuntimeOptions;
        serial?: AppSerial;
        compileService?: TargetCompileService;
        analytics?: AppAnalytics;
    }


```

## Bundled Directories

A target can use many packages in addition to the required "corepkg". To 
ensure that these packages are bundled into the web app, you must list them explicitly. For 
example in the pxttarget.json for http://github.com/microsoft/pxt-microbit, we see:
```typescript
    "bundleddirs": [
        "libs/core",
        "libs/radio",
        "libs/devices",
        "libs/bluetooth"
    ],
```
This ensures that the above four packages are compiled/bundled into the web app and delivered on the initial
download of the web app. Other packages for the micro:bit, such as http://github.com/microbit/pxt-neopixel 
are not bundled and remain on github.com, where they are loaded as needed by the web app (usually 
via an "add package" request by the end user).

## TargetVersions

PXT uses [semantic versioning](http://semver.org/) of its targets and packages.  The TargetVersions
interface has two relevant fields that are populated as specified in the comments below:
```typescript
    interface TargetVersions {
        target: string; // equal to version field in "package.json"
        pxt: string;    // equal to version field in "package.json" or "node_modules/pxt-core/package.json"
    }
```


## CompileTarget

## ProjectTemplate

## AppTheme

## Cloud resources

PXT has a cloud backend that provides a set of services to the web app.  The services are configured using
the "cloud" field in pxttarget.json, which follows the`AppCloud` interface:
```
    interface AppCloud {
        workspaces?: boolean;         // 
        packages?: boolean;
        publishing?: boolean;
        sharing?: boolean;            // uses cloud-based anonymous sharing
        importing?: boolean;          // import url dialog
        embedding?: boolean;
        preferredPackages?: string[]; // list of company/project(#tag) of packages
        githubPackages?: boolean;     // allow searching github for packages
    }
```
For example in the pxttarget.json for http://github.com/microsoft/pxt-microbit, we see:
```
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