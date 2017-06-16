# pxt.json Manual Page

A [PXT package](/packages) lives in its own directory (locally under libs/ in a PXT target or on github). A package
is described by the `pxt.json` file. Here is the `pxt.json` file for the pxt-neopixel package:

* https://github.com/Microsoft/pxt-neopixel

"Public" packages are stored in github.

The `pxt.json` is described by the interface `PackageConfig`:

```typescript
   interface PackageConfig {
        name: string;               // public => name must match ^[a-z][a-z0-9\-_]+
        files: string[];            // files to be included and compiled in package
        dependencies: Map<string>;  // package dependencies (usually "core": "*")
        public?: boolean;           // is the package found on github?

        // more description
        description?: string;       // longer description of package
        license?: string;           // name of license (as found on github)
        authors?: string[];

        // url to icon -- support for built-in packages only
        icon?: string;
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

        additionalFilePath?: string;
        gistId?: string;
    }
```
