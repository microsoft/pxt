# pxt.json Manual Page

A [PXT extension](/extension) lives in its own directory, locally under `libs/` in a PXT target. A extension
is described by the `pxt.json` file. To show a real example, here is the [pxt.json](https://github.com/Microsoft/pxt-neopixel/blob/master/pxt.json) file for the **pxt-neopixel** extension.

The `pxt.json` is described by the interface `PackageConfig` in [pxtpackage.d.ts](https://github.com/Microsoft/pxt/blob/master/localtypings/pxtpackage.d.ts#L15-L43):

## ~ hint

**Packages** are now referred to as **extensions**. The use of the _package_ name in identifiers implies _extension_.

## ~

```typescript-ignore
interface PackageConfig {
    name: string;                 // public:true -> name must match ^[a-z][a-z0-9\-_]+
    description?: string;         // longer description of extension
    license?: string;             // name of license (as found on github)
    authors?: string[];      
    
    files: string[];              // files to be included and compiled in the extension
    additionalFilePath?: string;  // another directory to find files from
    
    dependencies: Map<string>;    // extension dependencies (see below for more)
    public?: boolean;             // set true to enable the extension to be published (to cloud),
                                    // in support of publishing user scripts

    icon?: string;                // url to icon -- support for built-in extensions only
    card?: CodeCard;
    documentation?: string; // doc page to open when loading project

    // semver description for support target version
    version?: string;
    installedVersion?: string;
    targetVersions?: TargetVersions; // versions of the target/pxt the extension was compiled against

    testFiles?: string[];
    testDependencies?: Map<string>;
    simFiles?: string[];

    cppDependencies?: Map<string>;

    binaryonly?: boolean;
    platformio?: PlatformIOConfig;
    yotta?: YottaConfig;


    gistId?: string;
}
```

## dependencies (on other extensions)

Simple extensions generally just depend on their own target's core extension:
```typescript-ignore
    "dependencies": {
        "core": "file:../core"
    }
```

A number of targets use [**pxt-common-packages**][common-packages] and specialize 
them to fit their target's needs. These are a base set of extensions for use in a target. For example, the Adafruit Circuit Playground Express
[extension](https://github.com/Microsoft/pxt-adafruit/blob/master/libs/circuit-playground/pxt.json) is the union of a number of extensions. 

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

Each of the above extensions is local to the target but inherits code from **pxt-common-packages**, 
which it can then override or specialize, as the target needs. For example, the button [extension](https://github.com/Microsoft/pxt-adafruit/blob/master/libs/buttons/pxt.json)
in the target [**pxt-adafruit**][adafruit] is defined in terms of the button [extension](https://github.com/Microsoft/pxt-common-packages/blob/master/libs/buttons/pxt.json) from 
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

The `additionalFilePath` is recursive or multi-level - the `pxt.json` in the referenced directory
might have another `additionalFilePath` and it will work as expected.

## Test files

The files listed under `testFiles` are only included when the extension is compiled
as the top-level program and not just imported into some other program.
Typically this happens when you run `pxt` from command line in the
extension directory, or when you hit **Download** when editing extension itself in
the online editor.
They usually contain unit tests for extension.

Similarly, dependencies from `testDependencies` are only included when compiled
as top-level.

## C++ dependencies

Dependencies under `cppDependencies` are only considered when generating
code for the C++ compiler.
Usually, one would list all optional packages which contain
C++ code in `cppDependencies` of your core package.
Then, when user actually adds any of these optional packages, the
C++ code doesn't change and re-compilation (and thus cloud round-trip) is not required.

[adafruit]: https://github.com/Microsoft/pxt-adafruit
[common-packages]: https://github.com/Microsoft/pxt-common-packages