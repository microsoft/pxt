declare namespace pxt {

    type CodeCardType = "file" | "example" | "codeExample" | "tutorial" | "side" | "template" | "package" | "hw" | "forumUrl" | "forumExample" | "sharedExample" | "link";
    type CodeCardEditorType = "blocks" | "js" | "py";

    interface Map<T> {
        [index: string]: T;
    }

    interface TargetVersions {
        target: string;
        targetId?: string;
        targetWebsite?: string;
        pxt?: string;
        tag?: string;
        branch?: string;
        commits?: string; // URL
    }

    interface Size {
        width: number;
        height: number;
    }

    interface CodeCardAction {
        url: string,
        editor?: CodeCardEditorType;
        cardType?: CodeCardType;
    }

    /**
     * Schema for configuring a package's dependencies
     */
    interface PackageDependencySetting {
        hideAllBlocks?: boolean;         // including recursively included packages
        // TODO: think more about scenario and more general way to config?
    }


    /**
     * The schema for the pxt.json package files
     */
    interface PackageConfig {
        name: string;
        version?: string;
        // installedVersion?: string; moved to Package class
        // url to icon -- support for built-in packages only
        icon?: string;
        // semver description for support target version
        documentation?: string; // doc page to open when loading project, used by sidedocs
        targetVersions?: TargetVersions; // versions of the target/pxt the package was compiled against
        description?: string;
        dependencies: Map<string>;
        dependenciesSettings?: Map<PackageDependencySetting>;
        license?: string;
        authors?: string[];
        files: string[];
        simFiles?: string[];
        testFiles?: string[];
        fileDependencies?: Map<string>; // exclude certain files if dependencies are not fulfilled
        preferredEditor?: string; // tsprj, blocksprj, pyprj
        languageRestriction?: pxt.editor.LanguageRestriction; // language restrictions that have been placed on the package
        testDependencies?: pxt.Map<string>;
        cppDependencies?: pxt.Map<string>;
        public?: boolean;
        partial?: boolean; // true if project is not compileable on its own (eg base)
        binaryonly?: boolean;
        platformio?: PlatformIOConfig;
        compileServiceVariant?: string;
        palette?: string[];
        paletteNames?: string[];
        screenSize?: Size;
        yotta?: YottaConfig;
        codal?: CodalConfig;
        npmDependencies?: Map<string>;
        card?: CodeCard;
        additionalFilePath?: string;
        additionalFilePaths?: string[];
        core?: boolean;
        // used for sorting for core packages
        weight?: number;
        gistId?: string;
        extension?: PackageExtension; // describe the associated extension if any
        isExtension?: boolean; // is this package an extension
        dalDTS?: {
            corePackage?: string;
            includeDirs?: string[];
            excludePrefix?: string[];
            compileServiceVariant?: string;
        };
        features?: string[];
        hidden?: boolean; // hide package from package selection dialog
        searchOnly?: boolean; // do not show by default, only as search result
        skipLocalization?: boolean;
        snippetBuilders?: SnippetConfig[];
        experimentalHw?: boolean;
        requiredCategories?: string[]; // ensure that those block categories are visible
        supportedTargets?: string[]; // a hint about targets in which this extension is supported
        firmwareUrl?: string; // link to documentation page about upgrading firmware
        disablesVariants?: string[]; // don't build these variants, when this extension is enabled
        utf8?: boolean; // force compilation with UTF8 enabled
        disableTargetTemplateFiles?: boolean; // do not override target template files when commiting to github
        theme?: string | pxt.Map<string>;
        assetPack?: boolean; // if set to true, only the assets of this project will be imported when added as an extension (no code)
        assetPacks?: Map<boolean>; // a map of dependency id to boolean that indicates which dependencies should be imported as asset packs
    }


    interface PackageExtension {
        // Namespace to add the button under, defaults to package name
        namespace?: string;
        // Group to place button in
        group?: string;
        // Label for the flyout button, defaults to `Editor`
        label?: string;
        // for new category, category color
        color?: string;
        // for new category, is category advanced
        advanced?: boolean;
        // trusted custom editor url, must be register in targetconfig.json under approvedEditorExtensionUrls
        url?: string;
        // local debugging URL used when served through pxt serve and debugExtensions=1 mode
        localUrl?: string;
    }

    interface PlatformIOConfig {
        dependencies?: Map<string>;
    }

    interface CompilationConfig {
        description: string;
        config: any;
    }

    interface CodalConfig {
        libraries?: string[];
    }

    interface CodalJson {

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
        style?: string; // "card" | "item" | undefined;

        color?: string; // one of semantic ui colors
        description?: string;
        extracontent?: string;
        blocksXml?: string;
        typeScript?: string;
        imageUrl?: string;
        largeImageUrl?: string;
        videoUrl?: string;
        youTubeId?: string;
        youTubePlaylistId?: string; // playlist this video belongs to
        buttonLabel?: string;
        actionIcon?: string; // icon to override default icon on the action button
        time?: number;
        url?: string;
        learnMoreUrl?: string;
        buyUrl?: string;
        feedbackUrl?: string;
        responsive?: boolean;
        cardType?: CodeCardType;
        editor?: CodeCardEditorType;
        otherActions?: CodeCardAction[];
        directOpen?: boolean; // skip the details view, directly do the card action
        projectId?: string; // the project's header ID

        header?: string;

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
        displayName?: string;
        tilemapTile?: boolean;
        tileset?: string[];
        tags?: string[];
    }

    type SnippetOutputType = 'blocks'
    type SnippetOutputBehavior = /*assumed default*/'merge' | 'replace'
    interface SnippetConfig {
        name: string;
        namespace: string;
        group?: string;
        label: string;
        outputType: SnippetOutputType;
        outputBehavior?: SnippetOutputBehavior;
        initialOutput?: string;
        questions: SnippetQuestions[];
    }

    type SnippetAnswerTypes = 'number' | 'text' | 'variableName' | 'dropdown' | 'spriteEditor' | 'yesno' | string; // TODO(jb) Should include custom answer types for number, enums, string, image

    interface SnippetGoToOptions {
        question?: number;
        validate?: SnippetValidate;
        parameters?: SnippetParameters[]; // Answer token with corresponding question
    }

    interface SnippetOutputOptions {
        type: 'error' | 'hint';
        output: string;
    }

    interface SnippetParameters {
        token?: string;
        answer?: string;
        question: number;
    }

    interface SnippetInputAnswerSingular {
        answerToken: string;
        defaultAnswer: SnippetAnswerTypes;
    }

    interface SnippetInputAnswerPlural {
        answerTokens: string[];
        defaultAnswers: SnippetAnswerTypes[];
    }

    interface SnippetInputOtherType {
        type: string;
    }

    interface SnippetInputNumberType {
        type: 'number' | 'positionPicker';
        max?: number;
        min?: number;
    }

    interface SnippetInputDropdownType {
        type: "dropdown";
        options: pxt.Map<string>;
    }

    interface SnippetInputYesNoType {
        type: "yesno";
    }

    type SnippetQuestionInput = { label?: string; }
        & (SnippetInputAnswerSingular | SnippetInputAnswerPlural)
        & (SnippetInputOtherType | SnippetInputNumberType | SnippetInputDropdownType | SnippetInputYesNoType)

    interface SnippetValidateRegex {
        token: string;
        regex: string;
        match?: SnippetParameters;
        noMatch?: SnippetParameters;
    }

    interface SnippetValidate {
        regex?: SnippetValidateRegex;
    }

    interface SnippetQuestions {
        title: string;
        output?: string;
        outputConditionalOnAnswer?: string;
        errorMessage?: string;
        goto?: SnippetGoToOptions;
        inputs: SnippetQuestionInput[];
        hint?: string;
    }
}