# pxt.json Manual Page

A [PXT package](/packages) lives in its own directory, locally under libs/ in a PXT target. A package
is described by the `pxt.json` file. Here is the `pxt.json` file for the *pxt-neopixel* package:

* https://github.com/Microsoft/pxt-neopixel

The `pxt.json` is described by the interface `PackageConfig`:

```typescript
   interface PackageConfig {
        name: string;                 // public:true -> name must match ^[a-z][a-z0-9\-_]+
        description?: string;         // longer description of package
        license?: string;             // name of license (as found on github)
        authors?: string[];      
        
        files: string[];              // files to be included and compiled in package
        additionalFilePath?: string;  // another directory to find files from
        
        dependencies: Map<string>;    // package dependencies (see below for more)
        public?: boolean;             // set true to enable the package to be published (to cloud),
                                      // in support of publishing user scripts

        icon?: string;                // url to icon -- support for built-in packages only
        card?: CodeCard;
        documentation?: string; // doc page to open when loading project

        // semver description for support target version
        version?: string;
        installedVersion?: string;
        targetVersions?: TargetVersions; // versions of the target/pxt the package was compiled against

        testFiles?: string[];
        simFiles?: string[];

        binaryonly?: boolean;
        platformio?: PlatformIOConfig;
        yotta?: YottaConfig;


        gistId?: string;
    }
```

## dependencies (on other packages)

Simple packages generally just depend on their target's core package:
```typescript
    "dependencies": {
        "core": "file:../core"
    }
```

A number of targets use http://github.com/microsoft/pxt-common-packages and specialize 
them to fit their target's needs. For example, the Adafruit Circuit Playground Express
package is the union of a number of packages. 

```typescript
    "dependencies": {
        "core": "file:../core",
        "buttons": "file:../buttons",
        "accelerometer": "file:../accelerometer",
        "lightsensor": "file:../lightsensor",
        "thermometer": "file:../thermometer",
        "music": "file:../music",
        "light": "file:../light",
        "switch": "file:../switch",
        "infrared": "file:../infrared",
        "microphone": "file:../microphone",
        "touch": "file:../touch"
    }
```

Each of the above packages is local to the target but inherits code from *microsoft/pxt-common-packages*, 
which it can then override or specialize, as the target needs. For example, the button package
in the target *microsoft/pxt-adafruit* is defined in terms of the button package from 
*microsoft/pxt-common-packages* using the `additionalFilePath` field:
```typescript
{
    "name": "buttons",
    "description": "Button A and B drivers",
    "files": [
        "README.md",
        "buttons.cpp",
        "shims.d.ts",
        "enums.d.ts"
    ],
    "testFiles": [
        "test.ts"
    ],
    "additionalFilePath": "../../node_modules/pxt-common-packages/libs/buttons",
    "public": true,
    "dependencies": {
        "core": "file:../core"
    }
}
```
The `additionalFilePath` field refers to the `node_modules` directory of the target.






