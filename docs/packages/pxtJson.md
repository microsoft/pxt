# pxt.json Manual Page

A [PXT package](/packages) lives in its own directory (locally under libs/ in a PXT target or on github). A package
is described by the `pxt.json` file. Here is the `pxt.json` file for the pxt-neopixel package:

* https://github.com/Microsoft/pxt-neopixel

The `pxt.json` is described by the interface `PackageConfig`:

```typescript
   interface PackageConfig {
        name: string;               // friendly name of package
        description?: string;       // longer description of package
        license?: string;           // name of license (as found on github)
        authors?: string[];

        files: string[];            // files to be included and compiled in package
        dependencies: Map<string>;

        public?: boolean;
        // url to icon -- support for built-in packages only
        icon?: string;
        card?: CodeCard;
        documentation?: string; // doc page to open when loading project

        // semver description for support target version
        version?: string;
        installedVersion?: string;
        targetVersions?: TargetVersions; // versions of the target/pxt the package was compiled against

        simFiles?: string[];
        testFiles?: string[];

        binaryonly?: boolean;
        platformio?: PlatformIOConfig;
        yotta?: YottaConfig;

        additionalFilePath?: string;
        gistId?: string;
    }
```