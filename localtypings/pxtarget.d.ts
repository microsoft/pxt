/// <reference path="pxtpackage.d.ts" />
/// <reference path="pxtparts.d.ts" />
/// <reference path="blockly.d.ts" />

declare namespace pxt {
    // targetconfig.json
    interface TargetConfig {
        packages?: PackagesConfig;
    }

    interface PackagesConfig {
        approvedOrgs?: string[];
        approvedRepos?: string[];
        bannedOrgs?: string[];
        bannedRepos?: string[];
    }

    interface AppTarget {
        id: string; // has to match ^[a-z]+$; used in URLs and domain names
        forkof?: string; // id of a target we're based on
        nickname?: string; // friendly id used when generating files, folders, etc... forkof or id is used instead if missing
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
        logicBlocks?: boolean;
        loopsBlocks?: boolean;
        extraBlocks?: BlockToolboxDefinition[];
        onStartColor?: string;
        onStartNamespace?: string;
    }

    interface AppAnalytics {
        userVoiceApiKey?: string;
        userVoiceForumId?: number;
    }

    interface AppSerial {
        manufacturerFilter?: string; // used by node-serial
        nameFilter?: string; // regex to match devices
        log?: boolean;
    }

    interface AppCloud {
        workspaces?: boolean;
        packages?: boolean;
        sharing?: boolean;
        publishing?: boolean;
        preferredPackages?: string[]; // list of company/project(#tag) of packages
        githubPackages?: boolean; // allow searching github for packages
    }

    interface AppSimulator {
        autoRun?: boolean;
        stopOnChange?: boolean;
        streams?: boolean;
        aspectRatio?: number; // width / height
        boardDefinition?: pxsim.BoardDefinition;
        parts?: boolean; // parts enabled?
        instructions?: boolean;
        partsAspectRatio?: number; // aspect ratio of the simulator when parts are displayed
    }

    interface TargetCompileService {
        yottaTarget?: string; // bbc-microbit-classic-gcc
        yottaBinary?: string; // defaults to "pxt-microbit-app-combined.hex"
        yottaCorePackage?: string; // pxt-microbit-core
        githubCorePackage?: string; // microsoft/pxt-microbit-core
        platformioIni?: string[];
        gittag: string;
        serviceId: string;
        buildEngine?: string;  // default is yotta, set to platformio
    }

    interface SpecializedResource {
        name: string,
        browser?: string,
        os?: string,
        path: string
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
        embedUrl?: string;
        docMenu?: DocMenuEntry[];
        hideSideDocs?: boolean;
        sideDoc?: string; // if set: show the getting started button, clicking on getting started button links to that page
        hasReferenceDocs?: boolean; // if true: the monaco editor will add an option in the context menu to load the reference docs
        boardName?: string;
        privacyUrl?: string;
        termsOfUseUrl?: string;
        contactUrl?: string;
        accentColor?: string;
        locales?: Map<AppTheme>;
        cardLogo?: string;
        appLogo?: string;
        htmlDocIncludes?: Map<string>;
        htmlTemplates?: Map<string>;
        githubUrl?: string;
        usbHelp?: SpecializedResource[];
        usbDocs?: string;
        exportVsCode?: boolean;
        browserSupport?: SpecializedResource[];
        invertedMenu?: boolean; // if true: apply the inverted class to the menu
        coloredToolbox?: boolean; // if true: color the blockly toolbox categories
        invertedToolbox?: boolean; // if true: use the blockly inverted toolbox
        invertedMonaco?: boolean; // if true: use the vs-dark monaco theme
        blocklyOptions?: Blockly.Options; // Blockly options, see Configuration: https://developers.google.com/blockly/guides/get-started/web
        simAnimationEnter?: string; // Simulator enter animation
        simAnimationExit?: string; // Simulator exit animation
        projectGallery?: string;
        crowdinProject?: string;
        monacoToolbox?: boolean; // if true: show the monaco toolbox when in the monaco editor
        blockHats?: boolean; // if true, event blocks have hats
    }

    interface DocMenuEntry {
        name: string;
        // needs to have one of `path` or `subitems` 
        path?: string;
        subitems?: DocMenuEntry[];
    }

    interface TargetBundle extends AppTarget {
        bundledpkgs: Map<Map<string>>;
        bundleddirs: string[];
        versions: TargetVersions;
    }
}

declare namespace ts.pxtc {
    interface CompileTarget {
        isNative: boolean; // false -> JavaScript for simulator
        nativeType?: string; // currently only "thumb"
        hasHex: boolean;
        useUF2?: boolean;
        hexMimeType?: string;
        driveName?: string;
        jsRefCounting?: boolean;
        floatingPoint?: boolean;
        deployDrives?: string; // partial name of drives where the .hex file should be copied
        deployFileMarker?: string;
        shortPointers?: boolean; // set to true for 16 bit pointers
        flashCodeAlign?: number; // defaults to 1k
        upgrades?: UpgradePolicy[];
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
        justMyCode?: boolean;
        computeUsedSymbols?: boolean;

        embedMeta?: string;
        embedBlob?: string; // base64
    }

    interface UpgradePolicy {
        type: string;
        map?: pxt.Map<string>;
    }

    interface FuncInfo {
        name: string;
        type: string;
        args: number;
        value: number;
    }

    interface ExtensionInfo {
        functions: FuncInfo[];
        generatedFiles: pxt.Map<string>;
        extensionFiles: pxt.Map<string>;
        yotta?: pxt.YottaConfig;
        platformio?: pxt.PlatformIOConfig;
        sha: string;
        compileData: string;
        shimsDTS: string;
        enumsDTS: string;
        onlyPublic: boolean;
    }

    interface HexInfo {
        hex: string[];
    }
}
