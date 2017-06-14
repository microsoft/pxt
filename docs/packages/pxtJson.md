# PXT Packages and pxt.json

Packages are PXT's dynamic/static library mechanism for extending a target. Here is an
example of a simple package that extends the pxt-microbit target (https://github.com/microsoft/pxt-microbit) 
so that the micro:bit can drive a NeoPixel strip;
* https://github.com/Microsoft/pxt-neopixel
To see how this package is surfaced, visit http://makecode.microbit.org/ and select the "Add Package" option from the gear menu. You will see the package "neopixel" listed in the available options. If you click on it, a new block category named "Neopixel" will be added to the editor. 

## Package structure

A PXT package lives in its own directory (locally under libs/ in a PXT target or on github). A package
is described by the `pxt.json` file, which itself is described by the interface `PackageConfig` (see below). 

Here is the `pxt.json` file for the pxt-neopixel package:
* https://github.com/Microsoft/pxt-neopixel


```typescript
   interface PackageConfig {
        name: string;               // friendly name of package
        files: string[];            
        dependencies: Map<string>;

        version?: string;
        installedVersion?: string;
        // url to icon -- support for built-in packages only
        icon?: string;
        // semver description for support target version
        documentation?: string; // doc page to open when loading project
        targetVersions?: TargetVersions; // versions of the target/pxt the package was compiled against
        description?: string;

        license?: string;
        authors?: string[];

        simFiles?: string[];
        testFiles?: string[];
        public?: boolean;
        binaryonly?: boolean;
        platformio?: PlatformIOConfig;
        yotta?: YottaConfig;
        card?: CodeCard;
        additionalFilePath?: string;
        gistId?: string;
    }
```