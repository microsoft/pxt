/// <reference path="pxtpackage.d.ts" />
/// <reference path="pxtparts.d.ts" />

declare namespace pxt {
    interface AppTarget {
        id: string; // has to match ^[a-z]+$; used in URLs and domain names
        forkof?: string; // id of a target we're based on
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
    

    interface RuntimeOptions {
        mathBlocks?: boolean;
        textBlocks?: boolean;
        listsBlocks?: boolean;
        variablesBlocks?: boolean;
        logicBlocks?: boolean;
        loopsBlocks?: boolean;

        extraBlocks?: {
            namespace: string;
            type: string;
            gap?: number;
            weight?: number;
            fields?: Map<string>;
        }[]
    }

    interface AppAnalytics {
        userVoiceApiKey?: string;
        userVoiceForumId?: number;
    }

    interface AppSerial {
        manufacturerFilter?: string; // used by node-serial
        log?: boolean;
    }

    interface AppCloud {
        workspaces?: boolean;
        packages?: boolean;
        preferredPackages?: string[]; // list of company/project(#tag) of packages
    }

    interface AppSimulator {
        autoRun?: boolean;
        streams?: boolean;
        aspectRatio?: number; // width / height
        boardDefinition?: pxsim.BoardDefinition;
        parts?: boolean; // parts enabled?
        instructions?: boolean;
        partsAspectRatio?: number; // aspect ratio of the simulator when parts are displayed
    }

    interface TargetCompileService {
        yottaTarget?: string; // bbc-microbit-classic-gcc
        yottaCorePackage?: string; // pxt-microbit-core
        githubCorePackage?: string; // microsoft/pxt-microbit-core
        gittag: string;
        serviceId: string;
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
        logoUrl?: string;
        logo?: string;
        portraitLogo?: string;
        rightLogo?: string;
        docsLogo?: string;
        organizationLogo?: string;
        homeUrl?: string;
        embedUrl?: string;
        docMenu?: DocMenuEntry[];
        sideDoc?: string;
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
        usbDocs?: string
        browserSupport?: SpecializedResource[];
    }

    interface DocMenuEntry {
        name: string;
        // needs to have one of `path` or `subitems` 
        path?: string;
        subitems?: DocMenuEntry[];
    }

}

declare namespace ts.pxtc {
    interface CompileTarget {
        simulatorPostMessage?: boolean; // provided by simulator as a post command message
        isNative: boolean; // false -> JavaScript for simulator
        nativeType?: string; // currently only "thumb"
        hasHex: boolean;
        hexMimeType?: string;
        driveName?: string;
        jsRefCounting?: boolean;
        floatingPoint?: boolean;
        deployDrives?: string; // partial name of drives where the .hex file should be copied
    }

    interface CompileOptions {
        fileSystem: pxt.Map<string>;
        target: CompileTarget;
        testMode?: boolean;
        sourceFiles?: string[];
        hexinfo: any;
        extinfo?: ExtensionInfo;
        noEmit?: boolean;
        ast?: boolean;
        breakpoints?: boolean;
        justMyCode?: boolean;
        computeUsedSymbols?: boolean;

        embedMeta?: string;
        embedBlob?: string; // base64
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
        yotta: pxt.YottaConfig;
        sha: string;
        compileData: string;
        shimsDTS: string;
        enumsDTS: string;
        onlyPublic: boolean;
    }
}
