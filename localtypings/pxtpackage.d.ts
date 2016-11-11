declare namespace pxt {
    interface Map<T> {
        [index: string]: T;
    }

    /**
     * The schema for the pxt.json package files
     */
    interface PackageConfig {
        name: string;
        version?: string;
        installedVersion?: string;
        // semver description for support target version
        documentation?: string; // doc page to open when loading project
        targetVersion?: string;
        description?: string;
        dependencies: Map<string>;
        license?: string;
        authors?: string[];
        files: string[];
        simFiles?: string[];
        testFiles?: string[];
        public?: boolean;
        binaryonly?: boolean;
        platformio?: PlatformIOConfig;
        yotta?: YottaConfig;
        card?: CodeCard;
        additionalFilePath?: string;
    }

    interface PlatformIOConfig {
        dependencies?: Map<string>;
    }

    interface YottaConfig {
        dependencies?: Map<string>;
        config?: any;
        configIsJustDefaults?: boolean;
        ignoreConflicts?: boolean;
    }

    interface CodeCard {
        name?: string;

        color?: string; // one of semantic ui colors
        description?: string;
        promoUrl?: string;
        blocksXml?: string;
        typeScript?: string;
        imageUrl?: string;
        time?: number;
        url?: string;
        responsive?: boolean;

        header?: string;
        any?: number;
        hardware?: number;
        software?: number;
        blocks?: number;
        javascript?: number;

        onClick?: (e: any) => void; // React event

        target?: string;
        className?: string;
    }
}