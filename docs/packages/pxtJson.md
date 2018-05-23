# pxt.json Manual Page

A [PXT package](/packages) lives in its own directory, locally under `libs/` in a PXT target. A package
is described by the `pxt.json` file. To show a real example, here is the [pxt.json](https://github.com/Microsoft/pxt-neopixel/blob/master/pxt.json) file for the **pxt-neopixel** package.

The `pxt.json` is described by the interface `PackageConfig` in [pxtpackage.d.ts](https://github.com/Microsoft/pxt/blob/master/localtypings/pxtpackage.d.ts#L15-L43):

```typescript-ignore
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
    testDependencies?: string[];
    simFiles?: string[];

    binaryonly?: boolean;
    platformio?: PlatformIOConfig;
    yotta?: YottaConfig;


    gistId?: string;
}
```

## dependencies (on other packages)

Simple packages generally just depend on their own target's core package:
```typescript-ignore
    "dependencies": {
        "core": "file:../core"
    }
```

A number of targets use [**pxt-common-packages**][common-packages] and specialize 
them to fit their target's needs. For example, the Adafruit Circuit Playground Express
[package](https://github.com/Microsoft/pxt-adafruit/blob/master/libs/circuit-playground/pxt.json) is the union of a number of packages. 

```typescript-ignore
    "dependencies": {
        "base": "file:../base",
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

Each of the above packages is local to the target but inherits code from **pxt-common-packages**, 
which it can then override or specialize, as the target needs. For example, the button [package](https://github.com/Microsoft/pxt-adafruit/blob/master/libs/buttons/pxt.json)
in the target [**pxt-adafruit**][adafruit] is defined in terms of the button [package](https://github.com/Microsoft/pxt-common-packages/blob/master/libs/buttons/pxt.json) from 
**pxt-common-packages** using the `additionalFilePath` field:
```typescript-ignore
{
    "description": "Button A and B drivers",
    "additionalFilePath": "../../node_modules/pxt-common-packages/libs/buttons"
}
```
The `additionalFilePath` field refers to the `node_modules` directory of the target.
The `pxt.json` file need to only specify what's changed (in the example above `description`)
with respect to the `pxt.json` in `additionalFilePath`.

[adafruit]: https://github.com/Microsoft/pxt-adafruit
[common-packages]: https://github.com/Microsoft/pxt-common-packages