/// <reference path="pxtpackage.d.ts" />
/// <reference path="pxtparts.d.ts" />
/// <reference path="blockly.d.ts" />

declare namespace pxt {
    // targetconfig.json
    interface TargetConfig {
        packages?: PackagesConfig;
        languages?: string[];
    }

    interface PackagesConfig {
        approvedOrgs?: string[];
        approvedRepos?: string[];
        bannedOrgs?: string[];
        bannedRepos?: string[];
        allowUnapproved?: boolean;
        preferredRepos?: string[]; // list of company/project(#tag) of packages to show by default in search
    }

    interface AppTarget {
        id: string; // has to match ^[a-z]+$; used in URLs and domain names
        platformid?: string; // eg "codal"; used when search for gh packages ("for PXT/codal"); defaults to id
        nickname?: string; // friendly id used when generating files, folders, etc... id is used instead if missing
        name: string;
        description?: string;
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
        analytics?: AppAnalytics;
    }

    interface ProjectTemplate {
        id: string;
        config: PackageConfig;
        files: Map<string>;
    }

    interface BlockToolboxDefinition {
        namespace: string;
        type: string;
        gap?: number;
        weight?: number;
        fields?: Map<string>;
    }

    interface RuntimeOptions {
        mathBlocks?: boolean;
        textBlocks?: boolean;
        listsBlocks?: boolean;
        variablesBlocks?: boolean;
        functionBlocks?: boolean;
        logicBlocks?: boolean;
        loopsBlocks?: boolean;
        onStartNamespace?: string; // default = loops
        onStartColor?: string;
        onStartWeight?: number;
        onStartUnDeletable?: boolean;
        extraBlocks?: BlockToolboxDefinition[];  // deprecated
    }

    interface AppAnalytics {
        userVoiceApiKey?: string;
        userVoiceForumId?: number;
    }

    interface AppSerial {
        useHF2?: boolean;
        vendorId?: string; // used by node-serial
        productId?: string; // used by node-serial
        nameFilter?: string; // regex to match devices
        rawHID?: boolean;
        log?: boolean; // pipe messages to log
        chromeExtension?: string; // unique identifier of the chrome extension
    }

    interface AppCloud {
        workspaces?: boolean;
        packages?: boolean;
        publishing?: boolean;
        sharing?: boolean; // uses cloud-based anonymous sharing
        importing?: boolean; // import url dialog
        embedding?: boolean;
        githubPackages?: boolean; // allow searching github for packages
    }

    interface AppSimulator {
        autoRun?: boolean;
        stopOnChange?: boolean;
        hideRestart?: boolean;
        enableTrace?: boolean;
        hideFullscreen?: boolean;
        streams?: boolean;
        aspectRatio?: number; // width / height
        boardDefinition?: pxsim.BoardDefinition;
        parts?: boolean; // parts enabled?
        instructions?: boolean;
        partsAspectRatio?: number; // aspect ratio of the simulator when parts are displayed
        headless?: boolean; // whether simulator should still run while collapsed
        trustedUrls?: string[]; // URLs that are allowed in simulator modal messages
    }

    interface TargetCompileService {
        yottaTarget?: string; // bbc-microbit-classic-gcc
        yottaBinary?: string; // defaults to "pxt-microbit-app-combined.hex"
        yottaCorePackage?: string; // pxt-microbit-core
        yottaConfig?: any; // additional config

        platformioIni?: string[];

        codalTarget?: string;
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
        logoUrl?: string;
        logo?: string;
        portraitLogo?: string;
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
        legacyDomain?: string;
        docMenu?: DocMenuEntry[];
        TOC?: TOCMenuEntry[];
        hideSideDocs?: boolean;
        sideDoc?: string; // @deprecated. if set: show the getting started button, clicking on getting started button links to that page
        hasReferenceDocs?: boolean; // if true: the monaco editor will add an option in the context menu to load the reference docs
        feedbackUrl?: string; // is set: a feedback link will show in the settings menu
        boardName?: string;
        driveDisplayName?: string; // name of the drive as it shows in the explorer
        privacyUrl?: string;
        termsOfUseUrl?: string;
        contactUrl?: string;
        accentColor?: string;
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
        blocklyOptions?: Blockly.Options; // Blockly options, see Configuration: https://developers.google.com/blockly/guides/get-started/web
        disableBlockIcons?: boolean; // Disable icons in blocks
        hideFlyoutHeadings?: boolean; // Hide the flyout headings at the top of the flyout when on a mobile device.
        monacoColors?: pxt.Map<string>; // Monaco theme colors, see https://code.visualstudio.com/docs/getstarted/theme-color-reference
        hideBlocklyJavascriptHint?: boolean; // hide javascript preview in blockly hint menu
        simAnimationEnter?: string; // Simulator enter animation
        simAnimationExit?: string; // Simulator exit animation
        hasAudio?: boolean; // target uses the Audio manager. if true: a mute button is added to the simulator toolbar.
        galleries?: pxt.Map<string>; // list of galleries to display in projects dialog
        crowdinProject?: string;
        crowdinBranch?: string; // optional branch specification for pxt
        monacoToolbox?: boolean; // if true: show the monaco toolbox when in the monaco editor
        blockHats?: boolean; // if true, event blocks have hats
        allowParentController?: boolean; // allow parent iframe to control editor
        hideEmbedEdit?: boolean; // hide the edit button in the embedded view
        blocksOnly?: boolean; // blocks only workspace
        hideDocsSimulator?: boolean; // do not show simulator button in docs
        hideDocsEdit?: boolean; // do not show edit button in docs
        hideCookieNotice?: boolean; // always hide cookie notice for targets that embed the editor in apps/chrome
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
        highContrast?: boolean; // simulator has a high contrast mode
        selectLanguage?: boolean; // add language picker to settings menu
        useUploadMessage?: boolean; // change "Download" text to "Upload"
        downloadIcon?: string; // which icon io use for download
        blockColors?: Map<string>; // block namespace colors, used for build in categories
        blocklyColors?: Blockly.Colours; // Blockly workspace, flyout and other colors
        socialOptions?: SocialOptions; // show social icons in share dialog, options like twitter handle and org handle
        showHomeScreen?: boolean; // show the home page on editor load
        noReloadOnUpdate?: boolean; // do not notify the user or reload the page when a new app cache is downloaded
        appPathNames?: string[]; // Authorized URL paths in electron or UWP, all other paths will display a warning banner
        defaultBlockGap?: number; // For targets to override block gap
        hideShareEmbed?: boolean; // don't show advanced embedding options in share dialog
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
        tutorial?: boolean;
        subitems?: DocMenuEntry[];
    }

    interface TOCMenuEntry {
        name: string;
        path?: string;
        subitems?: TOCMenuEntry[];

        prevName?: string;
        prevPath?: string;

        nextName?: string;
        nextPath?: string;

        markdown?: string;
    }

    interface TargetBundle extends AppTarget {
        bundledpkgs: Map<Map<string>>;   // @internal use only (cache)
        bundleddirs: string[];
        versions: TargetVersions;        // @derived
    }
}

declare namespace ts.pxtc {
    interface CompileTarget {
        isNative: boolean; // false -> JavaScript for simulator
        nativeType?: string; // currently only "thumb"
        hasHex: boolean;
        useUF2?: boolean;
        useMkcd?: boolean;
        useELF?: boolean;
        useModulator?: boolean;
        hexMimeType?: string;
        driveName?: string;
        jsRefCounting?: boolean;
        floatingPoint?: boolean;
        taggedInts?: boolean; // implies floatingPoint
        boxDebug?: boolean;
        deployDrives?: string; // partial name of drives where the .hex file should be copied
        deployFileMarker?: string;
        shortPointers?: boolean; // set to true for 16 bit pointers
        flashCodeAlign?: number; // defaults to 1k
        upgrades?: UpgradePolicy[];
        openocdScript?: string;
        flashChecksumAddr?: number;
        onStartText?: boolean;
        stackAlign?: number; // 1 word (default), or 2
        hidSelectors?: HidSelector[];
        emptyEventHandlerComments?: boolean; // true adds a comment for empty event handlers
    }

    interface CompileOptions {
        fileSystem: pxt.Map<string>;
        target: CompileTarget;
        testMode?: boolean;
        sourceFiles?: string[];
        hexinfo: HexInfo;
        extinfo?: ExtensionInfo;
        noEmit?: boolean;
        forceEmit?: boolean;
        ast?: boolean;
        breakpoints?: boolean;
        trace?: boolean;
        justMyCode?: boolean;
        computeUsedSymbols?: boolean;

        alwaysDecompileOnStart?: boolean; // decompiler only

        embedMeta?: string;
        embedBlob?: string; // base64

        /* @internal */
        ignoreFileResolutionErrors?: boolean; // ignores triple-slash directive errors; debug only
    }

    interface UpgradePolicy {
        type: "api" | "blockId" | "missingPackage" | "package";
        map?: pxt.Map<string>;
    }

    interface FuncInfo {
        name: string;
        argsFmt: string;
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
