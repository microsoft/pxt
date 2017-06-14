# PXT Packages and pxt.json

A [PXT package](/packages) lives in its own directory (locally under libs/ in a PXT target or on github). A package
is described by the `pxt.json` file. Here is the `pxt.json` file for the pxt-neopixel package:

* https://github.com/Microsoft/pxt-neopixel

The `pxt.json` is described by the interface `PackageConfig`: 

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