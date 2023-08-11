# pxt.json Manual Page

A [PXT extension](/extension) lives in its own directory, locally under `libs/` in a PXT target. A extension
is described by the `pxt.json` file. To show a real example, here is the [pxt.json](https://github.com/microsoft/pxt-neopixel/blob/master/pxt.json) file for the **pxt-neopixel** extension.

The `pxt.json` is described by the interface `PackageConfig` in [pxtpackage.d.ts](https://github.com/microsoft/pxt/blob/master/localtypings/pxtpackage.d.ts#L15-L43):

### ~ hint

#### Package terminology

**Packages** are now referred to as **extensions**. The use of the _package_ name in identifiers implies _extension_.

### ~

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

    fileDependencies?: Map<string>; // exclude certain files if dependencies are not fulfilled
    
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
[extension](https://github.com/microsoft/pxt-adafruit/blob/master/libs/circuit-playground/pxt.json) is the union of a number of extensions. 

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
which it can then override or specialize, as the target needs. For example, the button [extension](https://github.com/microsoft/pxt-adafruit/blob/master/libs/buttons/pxt.json)
in the target [**pxt-adafruit**][adafruit] is defined in terms of the button [extension](https://github.com/microsoft/pxt-common-packages/blob/master/libs/buttons/pxt.json) from 
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
as top-level. The ``testDependencies`` can be added for multiple targets
and will only be added if they can be resolved.

## File dependencies

While not very common,
in some extensions certain functionality should be only enabled when another
extension is already present in the project.
For example, a `weather` sensor package may have code for streaming weather
data over radio, but that should be only enabled when there's already the `radio`
extension in the project (to avoid problems on boards without radio, or when
Bluetooth disables radio).
Another solution to this problem is to create a new package `weather-radio`,
which depends on `weather` and `radio`.
This is advisable, when the additional functionality is sizable, otherwise
it's better to keep the number of packages down.

Example configuration:
```typescript-ignore
  ...
  "files": [
      "weather-reading.ts",
      "weather-radio.ts",
      "weather-jacdac.ts", 
      "jd-helper.ts",
      "README.md"
  ],
  "fileDependencies": {
      "weather-radio.ts": "radio",
      "weather-jacdac.ts": "jacdac",
      "jd-helper.ts": "jacdac"
  },
  ...
```

Here, the file `weather-radio.ts` will be only included when `radio` is referenced in
the project, and files `weather-jacdac.ts` and `jd-helper.ts` will be only included when
`jacdac` is present.

Typically, you would add `radio` and `jacdac` as `testDependencies`, so you can see
the entire extension in the editor.
There is no point in adding them as regular `dependencies` - that would negate the
effects of `fileDependencies` and always include both the dependencies and files.

In addition to package names, you can also use `target:microbit` or similar
to indicate that the file should be only included when compiling for a specific MakeCode
editor (other options include `target:maker` and `target:arcade`).

Finally, boolean expressions are allowed, using `!`, `&&` and `||` operators.
Parentheses are not allowed, and operator precedence is the same as in C or JavaScript
(`!` binds tighter than `&&`, which binds tighter than `||`).

```typescript-ignore
  ...
  "fileDependencies": {
      "weather-radio.ts": "!bluetooth && target:microbit",
      "weather-buttons.ts": "target:microbit && arcade-controls || target:arcade"
  },
  ...
```

In future, we may allow things like `"radio >= 1.2.3"`.

## C++ dependencies

Dependencies under `cppDependencies` are only considered when generating
code for the C++ compiler.
Usually, one would list all optional packages which contain
C++ code in `cppDependencies` of your core package.
Then, when user actually adds any of these optional packages, the
C++ code doesn't change and re-compilation (and thus cloud round-trip) is not required.

[adafruit]: https://github.com/microsoft/pxt-adafruit
[common-packages]: https://github.com/microsoft/pxt-common-packages

## Setting C++ constants for DAL config - yotta

Constants defined to form part of the `config.h` file for the the DAL platform used in the build are set in the `"yotta"` section. The `config` type is either `codal` or `microbit-dal`:

CODAL example:

```json
    "yotta": {
        "config": {
            "codal": {
                "component_count": 64,
                "dmesg_buffer_size": 1024
            }
        }
    }
```

micro:bit DAL example:

```json
    "yotta": {
        "config": {
            "microbit-dal": {
                "bluetooth": {
                    "enabled": 1
                }
            }
        }
    }
```

If not referring to a specific DAL platform, define simple `cpp` constants like this:

```json
    "yotta": {
        "config": {
            "DEVICE_USB": 1,
            "DEVICE_MOUSE": 1
        }
    }
```

See this [sample repo](https://github.com/lancaster-university/microbit-samples) for `config.json` examples of setting various hardware device constants.
