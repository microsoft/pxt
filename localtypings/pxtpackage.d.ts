declare namespace pxt {

    type CodeCardType = "file" | "example" | "codeExample" | "tutorial" | "side" | "template" | "package" | "hw";

    interface Map<T> {
        [index: string]: T;
    }

    interface TargetVersions {
        target: string;
        pxt?: string;
        pxtCrowdinBranch?: string;
        targetCrowdinBranch?: string;
        tag?: string;
        branch?: string;
        commits?: string; // URL
    }

    interface Size {
        width: number;
        height: number;
    }

    /**
     * The schema for the pxt.json package files
     */
    interface PackageConfig {
        name: string;
        version?: string;
        installedVersion?: string;
        // url to icon -- support for built-in packages only
        icon?: string;
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
        preferredEditor?: string; // tsprj, blocksprj, pyprj
        testDependencies?: pxt.Map<string>;
        cppDependencies?: pxt.Map<string>;
        public?: boolean;
        binaryonly?: boolean;
        platformio?: PlatformIOConfig;
        compileServiceVariant?: string;
        palette?: string[];
        screenSize?: Size;
        yotta?: YottaConfig;
        npmDependencies?: Map<string>;
        card?: CodeCard;
        additionalFilePath?: string;
        additionalFilePaths?: string[];
        core?: boolean;
        // used for sorting for core packages
        weight?: number;
        gistId?: string;
        extension?: PackageExtension; // describe the associated extension if any
        dalDTS?: {
            corePackage?: string;
            includeDirs?: string[];
            excludePrefix?: string[];
        };
        features?: string[];
        hidden?: boolean; // hide package from package selection dialog
        skipLocalization?: boolean;
    }

    interface PackageExtension {
        namespace?: string; // Namespace to add the button under, defaults to package name
        label?: string; // Label for the flyout button, defaults to `Editor`
        color?: string; // for new category, category color
        advanced?: boolean; // for new category, is category advanced
        localUrl?: string; // local debugging URL used when served through pxt serve and debugExtensions=1 mode
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
        title?: string;
        role?: string;
        ariaLabel?: string;
        label?: string;
        labelIcon?: string;
        labelClass?: string;
        tags?: string[]; // tags shown in home screen, colors specified in theme
        tabIndex?: number;

        color?: string; // one of semantic ui colors
        description?: string;
        extracontent?: string;
        blocksXml?: string;
        typeScript?: string;
        imageUrl?: string;
        largeImageUrl?: string;
        youTubeId?: string;
        time?: number;
        url?: string;
        learnMoreUrl?: string;
        buyUrl?: string;
        feedbackUrl?: string;
        responsive?: boolean;
        cardType?: CodeCardType;

        header?: string;
        any?: number;
        hardware?: number;
        software?: number;
        blocks?: number;
        javascript?: number;

        tutorialStep?: number;
        tutorialLength?: number;

        icon?: string;
        iconContent?: string; // Text instead of icon name
        iconColor?: string;

        onClick?: (e: any) => void; // React event
        onLabelClicked?: (e: any) => void;

        target?: string;
        className?: string;
        variant?: string;
    }

    interface JRes {
        id: string; // something like "sounds.bark"
        data: string;
        dataEncoding?: string; // must be "base64" or missing (meaning the same)
        icon?: string; // URL (usually data-URI) for the icon
        namespace?: string; // used to construct id
        mimeType: string;
    }
}