declare namespace pxt {
    interface Map<T> {
        [index: string]: T;
    }

    interface TargetVersions {
        target: string;
        pxt: string;
        tag?: string;
        branch?: string;
        commits?: string; // URL
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
        targetVersions?: TargetVersions; // versions of the target/pxt the package was compiled against
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
        gistId?: string;
    }

    interface PlatformIOConfig {
        dependencies?: Map<string>;
    }

    interface CompilationConfig {
        description: string;
        config: any;
    }

    interface YottaConfig {
        dependencies?: Map<string>;
        config?: any;
        /**
         * Overridable config flags
         */
        optionalConfig?: any;
        userConfigs?: CompilationConfig[];
        /* deprecated */
        configIsJustDefaults?: boolean;
        /* deprecated */
        ignoreConflicts?: boolean;
    }

    interface CodeCard {
        name?: string;
        shortName?: string;

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