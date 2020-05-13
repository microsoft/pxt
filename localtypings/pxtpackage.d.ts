declare namespace pxt {

    type CodeCardType = "file" | "example" | "codeExample" | "tutorial" | "side" | "template" | "package" | "hw" | "forumUrl";
    type CodeCardEditorType = "blocks" | "js" | "py";

    interface Map<T> {
        [index: string]: T;
    }

    interface TargetVersions {
        target: string;
        targetId?: string;
        targetWebsite?: string;
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

    interface CodeCardAction {
        url: string,
        editor?: CodeCardEditorType;
        cardType?: CodeCardType;
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
        snippetBuilders?: SnippetConfig[];
        experimentalHw?: boolean;
        requiredCategories?: string[]; // ensure that those block categories are visible
        supportedTargets?: string[]; // a hint about targets in which this extension is supported
        firmwareUrl?: string; // link to documentation page about upgrading firmware
        disablesVariants?: string[]; // don't build these variants, when this extension is enabled
        utf8?: boolean; // force compilation with UTF8 enabled
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
        time?: number;
        url?: string;
        learnMoreUrl?: string;
        buyUrl?: string;
        feedbackUrl?: string;
        responsive?: boolean;
        cardType?: CodeCardType;
        editor?: CodeCardEditorType;
        otherActions?: CodeCardAction[];

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