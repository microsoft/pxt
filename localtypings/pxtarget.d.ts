/// <reference path="pxtpackage.d.ts" />
/// <reference path="pxtparts.d.ts" />
/// <reference path="pxtblockly.d.ts" />
/// <reference path="pxtelectron.d.ts" />

declare namespace pxt {
    // targetconfig.json
    interface TargetConfig {
        packages?: PackagesConfig;
        // common galleries
        galleries?: pxt.Map<string>;
        // localized galleries
        localizedGalleries?: pxt.Map<pxt.Map<string>>;
        windowsStoreLink?: string;
        // link to the latest firmware urls (boardid -> url)
        firmwareUrls?: pxt.Map<string>;
        // release manifest for the electron app
        electronManifest?: pxt.electron.ElectronManifest;
    }

    interface PackagesConfig {
        approvedOrgs?: string[];
        approvedRepos?: string[]; // list of company/project
        releases?: pxt.Map<string[]>;  // per major version list of approved company/project#tag
        bannedOrgs?: string[];
        bannedRepos?: string[];
        allowUnapproved?: boolean;
        preferredRepos?: string[]; // list of company/project(#tag) of packages to show by default in search
    }

    interface AppTarget {
        id: string; // has to match ^[a-z]+$; used in URLs and domain names
        platformid?: string; // eg "codal"; used when search for gh packages ("for PXT/codal"); defaults to id
        nickname?: string; // friendly id used when generating files, folders, etc... id is used instead if missing
        name: string; // long name
        description?: string; // description
        thumbnailName?: string; // name imprited on thumbnails when using saveAsPNG
        corepkg: string;
        title?: string;
        cloud?: AppCloud;
        simulator?: AppSimulator;
        blocksprj: ProjectTemplate;
        tsprj: ProjectTemplate;
        runtime?: RuntimeOptions;
        compile: ts.pxtc.CompileTarget;
        serial?: AppSerial;
        appTheme: AppTheme;
        compileService?: TargetCompileService;
        ignoreDocsErrors?: boolean;
        variants?: Map<AppTarget>; // patches on top of the current AppTarget for different chip variants
        queryVariants?: Map<AppTarget>; // patches on top of the current AppTarget using query url regex
    }

    interface ProjectTemplate {
        id: string;
        config: PackageConfig;
        files: pxt.Map<string>;
    }

    interface BlockToolboxDefinition {
        namespace: string;
        type: string;
        gap?: number;
        weight?: number;
        fields?: pxt.Map<string>;
    }

    interface BlockOptions {
        category?: string;      // category in toolbox where the block should appear (defaults to "Loops")
        group?: string;         // group in toolbox category where the block should appear (defaults to none)
        color?: string;         // defaults to the color of the "Loops" category
        weight?: number;        // defaults to 0
        namespace?: string;     // namespace where the block's function lives (defaults to none)
        callName?: string;      // name of the block's function if changed in target
    }

    interface FunctionEditorTypeInfo {
        typeName?: string; // The actual type that gets emitted to ts
        label?: string; // A user-friendly label for the type, e.g. "text" for the string type
        icon?: string; // The className of a semantic icon, e.g. "calculator", "text width", etc
        defaultName?: string; // The default argument name to use in the function declaration for this type
    }

    interface RuntimeOptions {
        mathBlocks?: boolean;
        textBlocks?: boolean;
        listsBlocks?: boolean;
        variablesBlocks?: boolean;
        functionBlocks?: boolean;
        functionsOptions?: {
            extraFunctionEditorTypes?: FunctionEditorTypeInfo[];
        };
        logicBlocks?: boolean;
        loopsBlocks?: boolean;
        onStartNamespace?: string; // default = loops
        onStartColor?: string;
        onStartWeight?: number;
        onStartUnDeletable?: boolean;
        pauseUntilBlock?: BlockOptions;
        extraBlocks?: BlockToolboxDefinition[];  // deprecated
        assetExtensions?: string[];
        palette?: string[];
        screenSize?: Size;
        bannedCategories?: string[]; // a list of categories to exclude blocks from
    }

    interface AppSerial {
        useHF2?: boolean;
        noDeploy?: boolean;
        useEditor?: boolean;
        vendorId?: string; // used by node-serial
        productId?: string; // used by node-serial
        nameFilter?: string; // regex to match devices
        rawHID?: boolean;
        log?: boolean; // pipe messages to log
        editorTheme?: SerialTheme;
    }

    interface SerialTheme {
        graphBackground?: string;
        gridFillStyle?: string;
        gridStrokeStyle?: string;
        strokeColor?: string;
        lineColors?: string[];
    }

    interface AppCloud {
        workspaces?: boolean;
        packages?: boolean;
        sharing?: boolean; // uses cloud-based anonymous sharing
        thumbnails?: boolean; // attach screenshots/thumbnail to published scripts
        importing?: boolean; // import url dialog
        embedding?: boolean;
        githubPackages?: boolean; // allow searching github for packages
        noGithubProxy?: boolean;
        cloudProviders?: pxt.Map<{}>;
    }

    interface AppSimulator {
        autoRun?: boolean; // enable autoRun in regular mode, not light mode
        autoRunLight?: boolean; // force autorun in light mode
        stopOnChange?: boolean;
        emptyRunCode?: string; // when non-empty and autoRun is disabled, this code is run upon simulator first start
        hideRestart?: boolean;
        // moved to theme
        // enableTrace?: boolean;
        // moved to theme
        // debugger?: boolean;
        hideFullscreen?: boolean;
        streams?: boolean;
        aspectRatio?: number; // width / height
        boardDefinition?: pxsim.BoardDefinition;
        dynamicBoardDefinition?: boolean; // if true, boardDefinition comes from board package
        parts?: boolean; // parts enabled?
        // moved to theme
        // instructions?: boolean;
        partsAspectRatio?: number; // aspect ratio of the simulator when parts are displayed
        headless?: boolean; // whether simulator should still run while collapsed
        trustedUrls?: string[]; // URLs that are allowed in simulator modal messages
        invalidatedClass?: string; // CSS class to be applied to the sim iFrame when it needs to be updated (defaults to sepia filter)
        stoppedClass?: string; // CSS class to be applied to the sim iFrame when it isn't running (defaults to grayscale filter)
    }

    interface TargetCompileService {
        yottaTarget?: string; // bbc-microbit-classic-gcc
        yottaBinary?: string; // defaults to "pxt-microbit-app-combined.hex"
        yottaCorePackage?: string; // pxt-microbit-core
        yottaConfig?: any; // additional config

        platformioIni?: string[];

        codalTarget?: string | {
            name: string; // "codal-arduino-uno"
            url: string; // "https://github.com/lancaster-university/codal-arduino-uno"
            branch: string; // "master"
            type: string; // "git"
            branches?: pxt.Map<string>; // overrides repo url -> commit sha
        };
        codalBinary?: string;
        codalDefinitions?: any;

        dockerImage?: string;

        githubCorePackage?: string; // microsoft/pxt-microbit-core
        gittag: string;
        serviceId: string;
        buildEngine?: string;  // default is yotta, set to platformio
    }

    interface AppTheme {
        id?: string;
        name?: string;
        title?: string;
        description?: string;
        twitter?: string;
        defaultLocale?: string;
        logoWide?: boolean; // the portrait logo is not square, but wide
        logoUrl?: string;
        logo?: string;
        hideMenubarLogo?: boolean; // if true, partner logo won't be shown in the top-left corner (menu bar)
        portraitLogo?: string;
        highContrastLogo?: string;
        highContrastPortraitLogo?: string;
        rightLogo?: string;
        docsLogo?: string;
        organization?: string;
        organizationUrl?: string;
        organizationLogo?: string;
        organizationWideLogo?: string;
        homeUrl?: string;
        shareUrl?: string;
        embedUrl?: string;
        betaUrl?: string;
        docMenu?: DocMenuEntry[];
        TOC?: TOCMenuEntry[];
        hideSideDocs?: boolean;
        homeScreenHero?: string; // home screen hero image
        sideDoc?: string; // deprecated
        hasReferenceDocs?: boolean; // if true: the monaco editor will add an option in the context menu to load the reference docs
        feedbackUrl?: string; // is set: a feedback link will show in the settings menu
        boardName?: string; // official branded name for the board or product
        boardNickname?: string; // common nickname to use for the board or product
        driveDisplayName?: string; // name of the drive as it shows in the explorer
        privacyUrl?: string;
        termsOfUseUrl?: string;
        contactUrl?: string;
        accentColor?: string; // used in PWA manifest as theme color
        backgroundColor?: string; // use in PWA manifest as background color
        cardLogo?: string;
        appLogo?: string;
        htmlDocIncludes?: Map<string>;
        htmlTemplates?: Map<string>;
        githubUrl?: string;
        usbDocs?: string;
        invertedMenu?: boolean; // if true: apply the inverted class to the menu
        coloredToolbox?: boolean; // if true: color the blockly toolbox categories
        invertedToolbox?: boolean; // if true: use the blockly inverted toolbox
        invertedMonaco?: boolean; // if true: use the vs-dark monaco theme
        lightToc?: boolean; // if true: do NOT use inverted style in docs toc
        blocklyOptions?: Blockly.WorkspaceOptions; // Blockly options, see Configuration: https://developers.google.com/blockly/guides/get-started/web
        hideFlyoutHeadings?: boolean; // Hide the flyout headings at the top of the flyout when on a mobile device.
        monacoColors?: pxt.Map<string>; // Monaco theme colors, see https://code.visualstudio.com/docs/getstarted/theme-color-reference
        simAnimationEnter?: string; // Simulator enter animation
        simAnimationExit?: string; // Simulator exit animation
        hasAudio?: boolean; // target uses the Audio manager. if true: a mute button is added to the simulator toolbar.
        crowdinProject?: string;
        crowdinBranch?: string; // optional branch specification for localization files
        monacoToolbox?: boolean; // if true: show the monaco toolbox when in the monaco editor
        blockHats?: boolean; // if true, event blocks have hats
        allowParentController?: boolean; // allow parent iframe to control editor
        allowPackageExtensions?: boolean; // allow packages that include editor extensions
        allowSimulatorTelemetry?: boolean; // allow the simulator to send telemetry messages
        hideEmbedEdit?: boolean; // hide the edit button in the embedded view
        blocksOnly?: boolean; // blocks only workspace
        python?: boolean; // enable Python?
        hideDocsSimulator?: boolean; // do not show simulator button in docs
        hideDocsEdit?: boolean; // do not show edit button in docs
        hideMenuBar?: boolean; // Hides the main menu bar
        hideEditorToolbar?: boolean; // Hides the bottom editor toolbar
        appStoreID?: string; // Apple iTune Store ID if any
        mobileSafariDownloadProtocol?: string; // custom protocol to be used on iOS
        sounds?: {
            tutorialStep?: string;
            tutorialNext?: string;
            dialogClick?: string;
        },
        disableLiveTranslations?: boolean; // don't load translations from crowdin
        extendEditor?: boolean; // whether a target specific editor.js is loaded
        extendFieldEditors?: boolean; // wether a target specific fieldeditors.js is loaded
        highContrast?: boolean; // simulator has a high contrast mode
        print?: boolean; //Print blocks and text feature
        greenScreen?: boolean; // display webcam stream in background
        instructions?: boolean; // display make instructions
        enableTrace?: boolean; // Slow-Mo button
        debugger?: boolean; // debugger button
        selectLanguage?: boolean; // add language picker to settings menu
        availableLocales?: string[]; // the list of enabled language codes
        useUploadMessage?: boolean; // change "Download" text to "Upload"
        downloadIcon?: string; // which icon io use for download
        blockColors?: Map<string>; // block namespace colors, used for build in categories
        blockIcons?: Map<string>;
        blocklyColors?: Blockly.Colours; // Blockly workspace, flyout and other colors
        socialOptions?: SocialOptions; // show social icons in share dialog, options like twitter handle and org handle
        noReloadOnUpdate?: boolean; // do not notify the user or reload the page when a new app cache is downloaded
        appPathNames?: string[]; // Authorized URL paths in UWP, all other paths will display a warning banner
        defaultBlockGap?: number; // For targets to override block gap
        hideShareEmbed?: boolean; // don't show advanced embedding options in share dialog
        hideNewProjectButton?: boolean; // do not show the "new project" button in home page
        saveInMenu?: boolean; // move save icon under gearwheel menu
        fileNameExclusiveFilter?: string; // anything that does not match this regex is removed from the filename,
        copyrightText?: string; // footer text for any copyright text to be included at the bottom of the home screen and about page
        appFlashingTroubleshoot?: string; // Path to the doc about troubleshooting UWP app flashing failures, e.g. /device/windows-app/troubleshoot
        browserDbPrefixes?: { [majorVersion: number]: string }; // Prefix used when storing projects in the DB to allow side-by-side projects of different major versions
        editorVersionPaths?: { [majorVersion: number]: string }; // A map of major editor versions to their corresponding paths (alpha, v1, etc.)
        experiments?: string[]; // list of experiment ids, also enables this feature
        chooseBoardOnNewProject?: boolean; // when multiple boards are support, show board dialog on "new project"
        bluetoothUartConsole?: boolean; // pair with BLE UART services and pipe console output
        bluetoothUartFilters?: { name?: string; namePrefix?: string; }[]; // device name prefix -- required
        bluetoothPartialFlashing?: boolean; // enable partial flashing over BLE
        topBlocks?: boolean; // show a top blocks category in the editor
        pairingButton?: boolean; // display a pairing button
        tagColors?: pxt.Map<string>; // optional colors for tags
        dontSuspendOnVisibility?: boolean; // we're inside an app, don't suspend the editor
        disableFileAccessinMaciOs?: boolean; //Disable save & import of files in Mac and iOS, mainly used as embed webkit doesn't support these
        baseTheme?: string; // Use this to determine whether to show a light or dark theme, default is 'light', options are 'light', 'dark', or 'hc'
        scriptManager?: boolean; // Whether or not to enable the script manager. default: false
        monacoFieldEditors?: string[]; // A list of field editors to show in monaco. Currently only "image-editor" is supported
        /**
         * Internal and temporary flags:
         * These flags may be removed without notice, please don't take a dependency on them
         */
        simCollapseInMenu?: boolean; // don't show any of the collapse / uncollapse buttons down the bottom, instead show it in the menu
        bigRunButton?: boolean; // show the run button as a big button on the right
        transparentEditorToolbar?: boolean; // make the editor toolbar float with a transparent background
        hideProjectRename?: boolean; // Temporary flag until we figure out a better way to show the name
        addNewTypeScriptFile?: boolean; // when enabled, the [+] explorer button asks for file name, instead of using "custom.ts"
        simScreenshot?: boolean; // allows to download a screenshot of the simulator
        simScreenshotKey?: string; // keyboard key name
        simScreenshotMaxUriLength?: number; // maximum base64 encoded length to be uploaded
        simGif?: boolean; // record gif of the simulator
        simGifKey?: boolean; // shortcut to start stop
        simGifTransparent?: string; // specify the gif transparency color
        simGifQuality?: number; // generated gif quality (pixel sampling size) - 30 (poor) - 1 (best), default 16
        simGifMaxFrames?: number; // maximum number of frames, default 64
        simGifWidth?: number; // with in pixels for gif frames
        autoWebUSBDownload?: boolean; // automatically prompt user for webusb download
    }

    interface SocialOptions {
        twitterHandle?: string;
        orgTwitterHandle?: string;
        hashtags?: string;
        related?: string;
    }

    interface DocMenuEntry {
        name: string;
        // needs to have one of `path` or `subitems`
        path?: string;
        // force opening in separate window
        popout?: boolean;
        tutorial?: boolean;
        subitems?: DocMenuEntry[];
    }

    interface TOCMenuEntry {
        name: string;
        path?: string;
        subitems?: TOCMenuEntry[];
        markdown?: string;
    }

    interface TargetBundle extends AppTarget {
        bundledpkgs: Map<Map<string>>;   // @internal use only (cache)
        bundleddirs: string[];
        versions: TargetVersions;        // @derived
    }
}

declare namespace pxt.editor {
    const enum FileType {
        Text = "text",
        TypeScript = "typescript",
        JavaScript = "javascript",
        Markdown = "markdown",
        Python = "python",
        CPP = "cpp",
        JSON = "json",
        XML = "xml",
        Asm = "asm"
    }
}

declare namespace ts.pxtc {

    namespace ir {
        const enum CallingConvention {
            Plain,
            Async,
            Promise,
        }
    }

    interface CompileSwitches {
        profile?: boolean;
        gcDebug?: boolean;
        boxDebug?: boolean;
        slowMethods?: boolean;
        slowFields?: boolean;
        skipClassCheck?: boolean;
        noThisCheckOpt?: boolean;
        numFloat?: boolean;
        noTreeShake?: boolean;
        inlineConversions?: boolean;
        noPeepHole?: boolean;
        time?: boolean;
    }

    interface CompileTarget {
        isNative: boolean; // false -> JavaScript for simulator
        preferredEditor?: string; // used to indicate which way to run any source-level conversions (TS/Py/Blocks)
        nativeType?: string; // currently only "thumb"
        runtimeIsARM?: boolean; // when nativeType is "thumb" but runtime is compiled in ARM mode
        hasHex: boolean;
        useUF2?: boolean;
        useMkcd?: boolean;
        useELF?: boolean;
        saveAsPNG?: boolean;
        noSourceInFlash?: boolean;
        useModulator?: boolean;
        webUSB?: boolean; // use WebUSB when supported
        hexMimeType?: string;
        driveName?: string;
        jsRefCounting?: boolean;
        gc?: boolean;
        utf8?: boolean;
        switches: CompileSwitches;
        deployDrives?: string; // partial name of drives where the .hex file should be copied
        deployFileMarker?: string;
        shortPointers?: boolean; // set to true for 16 bit pointers
        flashCodeAlign?: number; // defaults to 1k
        flashEnd?: number;
        flashUsableEnd?: number;
        flashChecksumAddr?: number;
        ramSize?: number;
        patches?: pxt.Map<UpgradePolicy[]>; // semver range -> upgrade policies
        openocdScript?: string;
        uf2Family?: string;
        onStartText?: boolean;
        stackAlign?: number; // 1 word (default), or 2
        hidSelectors?: HidSelector[];
        emptyEventHandlerComments?: boolean; // true adds a comment for empty event handlers
        vmOpCodes?: pxt.Map<number>;
        vtableShift?: number; // defaults to 2, i.e., (1<<2) == 4 byte alignment of vtables, and thus 256k max program size; increase for chips with more flash!
        postProcessSymbols?: boolean;
        imageRefTag?: number;
    }

    type BlockContentPart = BlockLabel | BlockParameter | BlockImage;
    type BlockPart = BlockContentPart | BlockBreak;

    interface BlockLabel {
        kind: "label";
        text: string;
        style?: string[];
        cssClass?: string;
    }

    interface BlockParameter {
        kind: "param";
        ref: boolean;
        name: string;
        shadowBlockId?: string;
        varName?: string;
    }

    interface BlockBreak {
        kind: "break";
    }

    interface BlockImage {
        kind: "image";
        uri: string;
    }

    interface ParsedBlockDef {
        parts: ReadonlyArray<(BlockPart)>;
        parameters: ReadonlyArray<BlockParameter>;
    }

    interface CommentAttrs {
        debug?: boolean; // requires ?dbg=1
        shim?: string;
        shimArgument?: string;
        enumval?: string;
        helper?: string;
        help?: string;
        async?: boolean;
        promise?: boolean;
        hidden?: boolean;
        undeletable?: boolean;
        callingConvention: ir.CallingConvention;
        block?: string; // format of the block, used at namespace level for category name
        blockId?: string; // unique id of the block
        blockGap?: string; // pixels in toolbox after the block is inserted
        blockExternalInputs?: boolean; // force external inputs. Deprecated; see inlineInputMode.
        blockImportId?: string;
        blockBuiltin?: boolean;
        blockNamespace?: string;
        blockIdentity?: string;
        blockAllowMultiple?: boolean; // override single block behavior for events
        blockHidden?: boolean; // not available directly in toolbox
        blockImage?: boolean; // for enum variable, specifies that it should use an image from a predefined location
        blockCombine?: boolean;
        blockCombineShadow?: string;
        blockSetVariable?: string; // show block with variable assigment in toolbox. Set equal to a name to control the var name
        fixedInstances?: boolean;
        fixedInstance?: boolean;
        decompileIndirectFixedInstances?: boolean; // Attribute on TYPEs with fixedInstances set to indicate that expressions with that type may be decompiled even if not a fixed instance
        constantShim?: boolean;
        indexedInstanceNS?: string;
        indexedInstanceShim?: string;
        defaultInstance?: string;
        autoCreate?: string;
        noRefCounting?: boolean;
        color?: string;
        colorSecondary?: string;
        colorTertiary?: string;
        icon?: string;
        jresURL?: string;
        iconURL?: string;
        imageLiteral?: number;
        weight?: number;
        parts?: string;
        trackArgs?: number[];
        advanced?: boolean;
        deprecated?: boolean;
        useEnumVal?: boolean; // for conversion from typescript to blocks with enumVal
        callInDebugger?: boolean; // for getters, they will be invoked by the debugger.

        // on class
        snippet?: string; // value used to generate TS snippet
        pySnippet?: string; // value used to generate python snippet

        // On block
        subcategory?: string;
        group?: string;
        whenUsed?: boolean;
        jres?: string;
        useLoc?: string; // The qName of another API whose localization will be used if this API is not translated and if both block definitions are identical
        topblock?: boolean;
        topblockWeight?: number;
        // On namepspace
        subcategories?: string[];
        groups?: string[];
        groupIcons?: string[];
        groupHelp?: string[];
        labelLineWidth?: string;
        handlerStatement?: boolean; // indicates a block with a callback that can be used as a statement
        blockHandlerKey?: string; // optional field for explicitly declaring the handler key to use to compare duplicate events
        afterOnStart?: boolean; // indicates an event that should be compiled after on start when converting to typescript

        // on interfaces
        indexerGet?: string;
        indexerSet?: string;

        mutate?: string;
        mutateText?: string;
        mutatePrefix?: string;
        mutateDefaults?: string;
        mutatePropertyEnum?: string;
        inlineInputMode?: string; // can be inline, external, or auto
        expandableArgumentMode?: string; // can be disabled, enabled, or toggle
        draggableParameters?: string; // can be reporter or variable; defaults to variable


        /* start enum-only attributes (i.e. a block with shim=ENUM_GET) */

        enumName?: string; // The name of the enum as it will appear in the code
        enumMemberName?: string; // If the name of the enum was "Colors", this would be "color"
        enumStartValue?: number; // The lowest value to emit when going from blocks to TS
        enumIsBitMask?: boolean; // If true then values will be emitted in the form "1 << n"
        enumIsHash?: boolean; // if true, the name of the enum is normalized, then hashed to generate the value
        enumPromptHint?: string; // The hint that will be displayed in the member creation prompt
        enumInitialMembers?: string[]; // The initial enum values which will be given the lowest values available

        /* end enum-only attributes */

        optionalVariableArgs?: boolean;
        toolboxVariableArgs?: string;

        _name?: string;
        _source?: string;
        _def?: ParsedBlockDef;
        _expandedDef?: ParsedBlockDef;
        _untranslatedBlock?: string; // The block definition before it was translated
        _shadowOverrides?: pxt.Map<string>;
        jsDoc?: string;
        paramHelp?: pxt.Map<string>;
        // foo.defl=12 -> paramDefl: { foo: "12" }
        paramDefl: pxt.Map<string>;

        paramMin?: pxt.Map<string>; // min range
        paramMax?: pxt.Map<string>; // max range
        // Map for custom field editor parameters
        paramFieldEditor?: pxt.Map<string>; //.fieldEditor
        paramShadowOptions?: pxt.Map<pxt.Map<string>>; //.shadowOptions.
        paramFieldEditorOptions?: pxt.Map<pxt.Map<string>>; //.fieldOptions.

        duplicateShadowOnDrag?: boolean; // if true, duplicate the block when its shadow is dragged out (like function arguments)
    }

    interface ParameterDesc {
        name: string;
        description: string;
        type: string;
        initializer?: string;
        default?: string;
        properties?: PropertyDesc[];
        handlerParameters?: PropertyDesc[];
        options?: pxt.Map<PropertyOption>;
        isEnum?: boolean;
    }

    interface PropertyDesc {
        name: string;
        type: string;
    }

    interface PropertyOption {
        value: any;
    }

    const enum SymbolKind {
        None,
        Method,
        Property,
        Function,
        Variable,
        Module,
        Enum,
        EnumMember,
        Class,
        Interface,
    }

    interface SymbolInfo {
        attributes: CommentAttrs;
        name: string;
        namespace: string;
        kind: SymbolKind;
        parameters: ParameterDesc[];
        retType: string;
        extendsTypes?: string[]; // for classes and interfaces
        isInstance?: boolean;
        isContextual?: boolean;
        qName?: string;
        pkg?: string;
        snippet?: string;
        snippetName?: string;
        pySnippet?: string;
        pySnippetName?: string;
        blockFields?: ParsedBlockDef;
        isReadOnly?: boolean;
        combinedProperties?: string[];
        pyName?: string;
        pyQName?: string;
    }

    interface ApisInfo {
        byQName: pxt.Map<SymbolInfo>;
        jres?: pxt.Map<pxt.JRes>;
    }

    type InfoType = "memberCompletion" | "identifierCompletion" | "signature" | "symbol"
    interface SyntaxInfo {
        type: InfoType;
        position: number;

        symbols?: SymbolInfo[];
        beginPos?: number;
        endPos?: number;
        auxResult?: any;
    }

    interface CompileOptions {
        fileSystem: pxt.Map<string>;
        target: CompileTarget;
        testMode?: boolean;
        sourceFiles?: string[];
        generatedFiles?: string[];
        jres?: pxt.Map<pxt.JRes>;
        hexinfo: HexInfo;
        extinfo?: ExtensionInfo;
        noEmit?: boolean;
        forceEmit?: boolean;
        ast?: boolean;
        breakpoints?: boolean;
        trace?: boolean;
        justMyCode?: boolean;
        computeUsedSymbols?: boolean;
        name?: string;
        warnDiv?: boolean; // warn when emitting division operator
        apisInfo?: ApisInfo;

        syntaxInfo?: SyntaxInfo;

        alwaysDecompileOnStart?: boolean; // decompiler only
        allowedArgumentTypes?: string[]; // decompiler-only; the types allowed for user-defined function arguments in blocks (unlisted types will cause grey blocks)

        embedMeta?: string;
        embedBlob?: string; // base64

        /* @internal */
        ignoreFileResolutionErrors?: boolean; // ignores triple-slash directive errors; debug only
    }

    interface UpgradePolicy {
        type: "api" | "blockId" | "missingPackage" | "package" | "blockValue";
        map?: pxt.Map<string>;
    }

    interface FuncInfo {
        name: string;
        argsFmt: string[];
        value: number;
    }

    interface ExtensionInfo {
        functions: FuncInfo[];
        generatedFiles: pxt.Map<string>;
        extensionFiles: pxt.Map<string>;
        yotta?: pxt.YottaConfig;
        platformio?: pxt.PlatformIOConfig;
        npmDependencies?: pxt.Map<string>;
        sha: string;
        compileData: string;
        shimsDTS: string;
        enumsDTS: string;
        onlyPublic: boolean;
        commBase?: number;
    }

    interface HexInfo {
        hex: string[];
    }

    // HEX values as strings, e.g. "0xFF97"
    interface HidSelector {
        vid: string;
        pid: string;
        usagePage: string;
        usageId: string;
    }
}


declare namespace pxt.tutorial {
    interface TutorialStepInfo {
        fullscreen?: boolean;
        // no coding
        unplugged?: boolean;
        hasHint?: boolean;
        contentMd?: string;
        headerContentMd?: string;
    }

    interface TutorialOptions {
        tutorial?: string; // tutorial        
        tutorialName?: string; // tutorial title
        tutorialReportId?: string; // if this tutorial was user generated, the report abuse id
        tutorialStepInfo?: pxt.tutorial.TutorialStepInfo[];
        tutorialStep?: number; // current tutorial page
        tutorialReady?: boolean; // current tutorial page
        tutorialMd?: string; // full tutorial markdown
    }
    interface TutorialCompletionInfo {
        // id of the tutorial
        id: string;
        // number of steps completed
        steps: number;
    }
}