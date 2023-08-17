/// <reference path="../localtypings/pxtpackage.d.ts"/>
/// <reference path="../localtypings/pxtparts.d.ts"/>
/// <reference path="../localtypings/pxtarget.d.ts"/>
/// <reference path="../localtypings/projectheader.d.ts"/>
/// <reference path="util.ts"/>
/// <reference path="apptarget.ts"/>
/// <reference path="tickEvent.ts"/>

namespace pxt.perf {
    // These functions are defined in docfiles/pxtweb/cookieCompliance.ts
    export declare let perfReportLogged: boolean;
    export declare function report(): void;
    export declare function recordMilestone(msg: string, time?: number): void;
    export declare function measureStart(name: string): void;
    export declare function measureEnd(name: string): void;
}
(function () {
    // Sometimes these aren't initialized, for example in tests. We only care about them
    // doing anything in the browser.
    if (!pxt.perf.report)
        pxt.perf.report = () => { }
    if (!pxt.perf.recordMilestone)
        pxt.perf.recordMilestone = () => { }
    if (!pxt.perf.measureStart)
        pxt.perf.measureStart = () => { }
    if (!pxt.perf.measureEnd)
        pxt.perf.measureEnd = () => { }
})()

namespace pxt {
    export import U = pxtc.Util;
    export import Util = pxtc.Util;

    export interface TCPIO {
        onData: (v: Uint8Array) => void;
        onError: (e: Error) => void;
        connectAsync(): Promise<void>;
        sendPacketAsync(pkt: Uint8Array): Promise<void>;
        error(msg: string): any;
        disconnectAsync(): Promise<void>;
    }

    export let mkTCPSocket: (host: string, port: number) => TCPIO;

    let savedAppTarget: TargetBundle;
    let savedSwitches: pxtc.CompileSwitches = {}

    export function setAppTarget(trg: TargetBundle) {
        appTarget = trg || <TargetBundle>{};
        patchAppTarget();
        savedAppTarget = U.cloneTargetBundle(appTarget)
    }

    let apiInfo: Map<PackageApiInfo>;
    export function setBundledApiInfo(inf: Map<PackageApiInfo>) {
        for (const pkgName of Object.keys(inf)) {
            const byQName = inf[pkgName].apis.byQName
            for (const apiName of Object.keys(byQName)) {
                const sym = byQName[apiName]
                const lastDot = apiName.lastIndexOf(".")
                const pyQName = sym.pyQName;
                // re-create the object - this will hint the JIT that these are objects of the same type
                // and the same hidden class should be used
                const newsym = byQName[apiName] = {
                    kind: Math.abs(sym.kind || 7),
                    qName: apiName,
                    namespace: apiName.slice(0, lastDot < 0 ? 0 : lastDot),
                    name: apiName.slice(lastDot + 1),
                    pyQName: pyQName,
                    pyName: pyQName ? pyQName.slice(pyQName.lastIndexOf(".") + 1) : undefined,
                    fileName: "",
                    attributes: sym.attributes || ({} as any),
                    retType: sym.retType || "void",
                    parameters: sym.parameters ? sym.parameters.map(p => ({
                        name: p.name,
                        description: p.description || "",
                        type: p.type || "number",
                        initializer: p.initializer,
                        default: p.default,
                        options: p.options || {},
                        isEnum: !!p.isEnum,
                        handlerParameters: p.handlerParameters
                    })) : null,
                    extendsTypes: sym.extendsTypes,
                    snippet: sym.kind && sym.kind < 0 ? null as any : undefined,
                    isInstance: !!sym.isInstance,
                    isReadOnly: !!sym.isReadOnly,
                }
                const attr = newsym.attributes
                if (!attr.paramDefl) attr.paramDefl = {}
                if (!attr.callingConvention) attr.callingConvention = 0
                if (!attr.paramHelp) attr.paramHelp = {}
                if (!attr.jsDoc) attr.jsDoc = ""
                attr._name = newsym.name.replace(/@.*/, "")
            }
        }
        apiInfo = inf;
    }

    export function getBundledApiInfo() {
        return apiInfo;
    }

    export function savedAppTheme(): AppTheme {
        return savedAppTarget ? savedAppTarget.appTheme : undefined;
    }

    export function setCompileSwitch(name: string, value: boolean) {
        if (/^csv-/.test(name)) {
            pxt.setAppTargetVariant(name.replace(/^csv-*/, ""))
        } else if (appTarget) {
            (savedSwitches as any)[name] = value
            U.jsonCopyFrom(appTarget.compile.switches, savedSwitches)
            U.jsonCopyFrom(savedAppTarget.compile.switches, savedSwitches)
        }
    }

    export function setCompileSwitches(names: string) {
        if (!names)
            return
        for (let s of names.split(/[\s,;:]+/)) {
            if (!s) continue
            if (s[0] == "-") {
                setCompileSwitch(s.slice(1), false)
            } else {
                setCompileSwitch(s, true)
            }
        }
    }

    let _bundledcoresvgs: pxt.Map<string>;
    export function bundledSvg(id: string): string {
        if (!id) return undefined;

        let res = _bundledcoresvgs && _bundledcoresvgs[id];
        if (res) return res; // cache hit

        // find all core packages images
        if (!appTarget.simulator || !appTarget.simulator.dynamicBoardDefinition)
            return undefined;

        if (!_bundledcoresvgs)
            _bundledcoresvgs = {};

        const files = pxt.appTarget.bundledpkgs[id];
        if (!files)
            return undefined;

        // builtin packages are guaranteed to parse out
        const pxtjson: pxt.PackageConfig = JSON.parse(files["pxt.json"]);
        if (pxtjson.core && files["board.json"]) {
            const boardjson = JSON.parse(files["board.json"]) as pxsim.BoardDefinition;
            if (boardjson && boardjson.visual && (<pxsim.BoardImageDefinition>boardjson.visual).image) {
                let boardimg = (<pxsim.BoardImageDefinition>boardjson.visual).image;
                if (/^pkg:\/\//.test(boardimg))
                    boardimg = files[boardimg.slice(6)];
                // this call gets expensive when having large number of boards
                _bundledcoresvgs[id] = `data:image/svg+xml;base64,${ts.pxtc.encodeBase64(pxt.Util.toUTF8(boardimg))}`;
            }
        }

        return _bundledcoresvgs[id];
    }


    export function replaceStringsInJsonBlob(blobPart: any, matcher: RegExp, matchHandler: (matchingString: string) => string): any {
        if (Array.isArray(blobPart)) {
            return blobPart.map(el => replaceStringsInJsonBlob(el, matcher, matchHandler));
        } else if (typeof blobPart === "object") {
            for (const key of Object.keys(blobPart)) {
                blobPart[key] = replaceStringsInJsonBlob(blobPart[key], matcher, matchHandler);
            }
            return blobPart;
        } else if (typeof blobPart === "string" && matcher.test(blobPart)) {
            return matchHandler(blobPart);
        } else {
            return blobPart;
        }
    }

    function replaceCdnUrlsInJsonBlob(cfg: any): any {
        return replaceStringsInJsonBlob(cfg, /^@cdnUrl@/i, m => pxt.BrowserUtils.patchCdn(m));
    }

    function patchAppTarget() {
        // patch-up the target
        let comp = appTarget.compile
        if (!comp)
            comp = appTarget.compile = { isNative: false, hasHex: false, switches: {} }
        if (comp.hasHex) {
            if (!comp.nativeType)
                comp.nativeType = pxtc.NATIVE_TYPE_THUMB
        }
        if (!comp.switches)
            comp.switches = {}
        if (comp.nativeType == pxtc.NATIVE_TYPE_VM)
            comp.sourceMap = true
        U.jsonCopyFrom(comp.switches, savedSwitches)
        // JS ref counting currently not supported
        comp.jsRefCounting = false
        if (!comp.useUF2 && !comp.useELF && comp.noSourceInFlash == undefined)
            comp.noSourceInFlash = true // no point putting sources in hex to be flashed
        if (comp.utf8 === undefined)
            comp.utf8 = true
        if (!appTarget.appTheme) appTarget.appTheme = {}
        if (!appTarget.appTheme.embedUrl)
            appTarget.appTheme.embedUrl = appTarget.appTheme.homeUrl
        let cs = appTarget.compileService
        if (cs) {
            if (cs.yottaTarget && !cs.yottaBinary)
                cs.yottaBinary = "pxt-microbit-app-combined.hex"
        }

        // patch cdn url locations
        appTarget = replaceCdnUrlsInJsonBlob(appTarget);

        // patch icons in bundled packages
        Object.keys(appTarget.bundledpkgs).forEach(pkgid => {
            const res = appTarget.bundledpkgs[pkgid];
            // path config before storing
            const config = JSON.parse(res[pxt.CONFIG_NAME]) as pxt.PackageConfig;
            if (config.icon) config.icon = pxt.BrowserUtils.patchCdn(config.icon);
            res[pxt.CONFIG_NAME] = pxt.Package.stringifyConfig(config);
        })

        // patch any pre-configured query url appTheme overrides
        if (typeof window !== 'undefined') {
            // Map<AppTarget>
            const queryVariants: Map<any> = {
                "lockededitor=1": {
                    appTheme: {
                        lockedEditor: true
                    }
                },
                "hidemenu=1": {
                    appTheme: {
                        hideMenuBar: true
                    }
                }
            }
            // import target specific flags
            if (appTarget.queryVariants)
                Util.jsonCopyFrom(queryVariants, appTarget.queryVariants);

            const href = window.location.href;
            Object.keys(queryVariants).forEach(queryRegex => {
                const regex = new RegExp(queryRegex, "i");
                const match = regex.exec(href);
                if (match) {
                    // Apply any appTheme overrides
                    let v = queryVariants[queryRegex];
                    if (v) {
                        U.jsonMergeFrom(appTarget, v);
                    }
                }
            });
        }
    }

    export function reloadAppTargetVariant(temporary = false) {
        pxt.perf.measureStart("reloadAppTargetVariant")
        const curr = temporary ? "" : JSON.stringify(appTarget);
        appTarget = U.cloneTargetBundle(savedAppTarget)
        if (appTargetVariant) {
            const v = appTarget.variants && appTarget.variants[appTargetVariant];
            if (v)
                U.jsonMergeFrom(appTarget, v)
            else
                U.userError(lf("Variant '{0}' not defined in pxtarget.json", appTargetVariant))
        }
        patchAppTarget();
        // check if apptarget changed
        if (!temporary && onAppTargetChanged && curr != JSON.stringify(appTarget))
            onAppTargetChanged();
        pxt.perf.measureEnd("reloadAppTargetVariant")
    }

    // this is set by compileServiceVariant in pxt.json
    export function setAppTargetVariant(variant: string, opts: {
        force?: boolean,
        temporary?: boolean
    } = {}): void {
        pxt.debug(`app variant: ${variant}`);
        if (!opts.force && (appTargetVariant === variant || (!appTargetVariant && !variant))) return;
        appTargetVariant = variant
        reloadAppTargetVariant(opts.temporary);
    }

    // notify when app target was changed
    export let onAppTargetChanged: () => void;

    // This causes the `hw` package to be replaced with `hw---variant` upon package load
    // the pxt.json of hw---variant would generally specify compileServiceVariant
    // This is controlled by ?hw=variant or by configuration created by dragging `config.bin`
    // into editor.
    export function setHwVariant(variant: string, name?: string) {
        variant = variant.replace(/.*---/, "")
        if (/^[\w\-]+$/.test(variant)) {
            hwVariant = variant;
            hwName = name || variant;
        } else {
            hwVariant = null;
            hwName = null;
        }
        pxt.debug(`hwVariant: ${hwVariant} (${hwName})`)
    }

    export function hasHwVariants(): boolean {
        return !!pxt.appTarget.variants
            && Object.keys(pxt.appTarget.bundledpkgs).some(pkg => /^hw---/.test(pkg));
    }

    export function getHwVariants(): PackageConfig[] {
        if (!pxt.appTarget.variants)
            return []
        let hws = Object.keys(pxt.appTarget.bundledpkgs).filter(pkg => /^hw---/.test(pkg))
        return hws
            .map(pkg => JSON.parse(pxt.appTarget.bundledpkgs[pkg][CONFIG_NAME]))
            .filter((cfg: PackageConfig) => {
                if (pxt.appTarget.appTheme.experimentalHw)
                    return true
                return !cfg.experimentalHw
            })
    }

    export interface PxtOptions {
        debug?: boolean;
        light?: boolean; // low resource device
        wsPort?: number;
    }
    export let options: PxtOptions = {};

    // general error reported
    export let debug: (msg: any) => void = typeof console !== "undefined" && !!console.debug
        ? (msg) => {
            if (pxt.options.debug)
                console.debug(msg);
        } : () => { };
    export let log: (msg: any) => void = typeof console !== "undefined" && !!console.log
        ? (msg) => {
            console.log(msg);
        } : () => { };

    export let reportException: (err: any, data?: Map<string | number>) => void = function (e, d) {
        if (console) {
            console.error(e);
            if (d) {
                try {
                    // log it as object, so native object inspector can be used
                    console.log(d)
                    //pxt.log(JSON.stringify(d, null, 2))
                } catch (e) { }
            }
        }
    }
    export let reportError: (cat: string, msg: string, data?: Map<string | number>) => void = function (cat, msg, data) {
        if (console) {
            console.error(`${cat}: ${msg}`);
            if (data) {
                try {
                    pxt.log(JSON.stringify(data, null, 2))
                } catch (e) { }
            }
        }
    }

    export interface WebConfig {
        relprefix: string; // "/beta---",
        workerjs: string;  // "/beta---worker",
        monacoworkerjs: string; // "/beta---monacoworker",
        gifworkerjs: string; // /beta---gifworker",
        serviceworkerjs: string; // /beta---serviceworker
        typeScriptWorkerJs: string; // /beta---tsworker
        pxtVersion: string; // "?",
        pxtRelId: string; // "9e298e8784f1a1d6787428ec491baf1f7a53e8fa",
        pxtCdnUrl: string; // "https://pxt.azureedge.net/commit/9e2...e8fa/",
        commitCdnUrl: string; // "https://pxt.azureedge.net/commit/9e2...e8fa/",
        blobCdnUrl: string; // "https://pxt.azureedge.net/commit/9e2...e8fa/",
        cdnUrl: string; // "https://pxt.azureedge.net"
        targetUrl: string; // "https://pxt.microbit.org"
        targetVersion: string; // "?",
        targetRelId: string; // "9e298e8784f1a1d6787428ec491baf1f7a53e8fa",
        targetId: string; // "microbit",
        simUrl: string; // "https://trg-microbit.userpxt.io/beta---simulator"
        simserviceworkerUrl: string; // https://trg-microbit.userpxt.io/beta---simserviceworker
        simworkerconfigUrl: string; // https://trg-microbit.userpxt.io/beta---simworkerconfig
        partsUrl?: string; // /beta---parts
        runUrl?: string; // "/beta---run"
        docsUrl?: string; // "/beta---docs"
        multiUrl?: string; // "/beta---multi"
        asseteditorUrl?: string; // "/beta---asseteditor"
        skillmapUrl?: string; // "/beta---skillmap"
        authcodeUrl?: string; // "/beta---authcode"
        multiplayerUrl?: string; // "/beta---multiplayer"
        kioskUrl?: string; // "/beta---kiosk"
        isStatic?: boolean;
        verprefix?: string; // "v1"
    }

    export function localWebConfig() {
        let r: WebConfig = {
            relprefix: "/--",
            workerjs: "/worker.js",
            monacoworkerjs: "/monacoworker.js",
            gifworkerjs: "/gifjs/gif.worker.js",
            serviceworkerjs: "/serviceworker.js",
            typeScriptWorkerJs: "/tsworker.js",
            pxtVersion: "local",
            pxtRelId: "localRelId",
            pxtCdnUrl: "/cdn/",
            commitCdnUrl: "/cdn/",
            blobCdnUrl: "/blb/",
            cdnUrl: "/cdn/",
            targetUrl: "",
            targetVersion: "local",
            targetRelId: "",
            targetId: appTarget ? appTarget.id : "",
            simUrl: "/sim/simulator.html",
            simserviceworkerUrl: "/simulatorserviceworker.js",
            simworkerconfigUrl: "/sim/workerConfig.js",
            partsUrl: "/sim/siminstructions.html"
        }
        return r
    }

    export let webConfig: WebConfig;

    export function getOnlineCdnUrl(): string {
        if (!webConfig) return null
        let m = /^(https:\/\/[^\/]+)/.exec(webConfig.commitCdnUrl)
        if (m) return m[1]
        else return null
    }

    export function setupWebConfig(cfg: WebConfig) {
        if (cfg) webConfig = cfg;
        else if (!webConfig) webConfig = localWebConfig()
    }

    export interface Host {
        readFile(pkg: Package, filename: string, skipAdditionalFiles?: boolean): string;
        writeFile(pkg: Package, filename: string, contents: string, force?: boolean): void;
        downloadPackageAsync(pkg: Package, deps?: string[]): Promise<void>;
        getHexInfoAsync(extInfo: pxtc.ExtensionInfo): Promise<pxtc.HexInfo>;
        cacheStoreAsync(id: string, val: string): Promise<void>;
        cacheGetAsync(id: string): Promise<string>; // null if not found
    }

    // this is for remote file interface to packages
    export interface FsFile {
        name: string;  // eg "main.ts"
        mtime: number; // ms since epoch
        content?: string; // not returned in FsPkgs
        prevContent?: string; // only used in write reqs
    }

    export interface FsPkg {
        path: string; // eg "foo/bar"
        config: pxt.PackageConfig; // pxt.json
        header: pxt.workspace.Header;
        files: FsFile[]; // this includes pxt.json
        icon?: string;
        isDeleted?: boolean; // whether this project has been deleted by the user
    }

    export interface FsPkgs {
        pkgs: FsPkg[];
    }

    export interface ICompilationOptions {

    }

    export function getEmbeddedScript(id: string): Map<string> {
        return U.lookup(appTarget.bundledpkgs || {}, id)
    }

    let _targetConfigPromise: Promise<pxt.TargetConfig> = undefined;
    export function targetConfigAsync(): Promise<pxt.TargetConfig> {
        if (!_targetConfigPromise) // cached promise
            _targetConfigPromise = Cloud.downloadTargetConfigAsync()
                .then(
                    js => { return js || {}; },
                    err => { return {}; }
                );
        return _targetConfigPromise;
    }
    export function packagesConfigAsync(): Promise<pxt.PackagesConfig> {
        return targetConfigAsync().then(config => config ? config.packages : undefined);
    }

    export const CONFIG_NAME = "pxt.json"
    export const SIMSTATE_JSON = ".simstate.json"
    export const SERIAL_EDITOR_FILE = "serial.txt"
    export const README_FILE = "README.md"
    export const GITIGNORE_FILE = ".gitignore"
    export const ASSETS_FILE = "assets.json"
    export const CLOUD_ID = "pxt/"
    export const BLOCKS_PROJECT_NAME = "blocksprj";
    export const JAVASCRIPT_PROJECT_NAME = "tsprj";
    export const PYTHON_PROJECT_NAME = "pyprj";
    export const MAIN_BLOCKS = "main.blocks";
    export const MAIN_TS = "main.ts";
    export const MAIN_PY = "main.py";
    export const DEFAULT_GROUP_NAME = "other"; // used in flyout, for snippet groups
    export const TILEMAP_CODE = "tilemap.g.ts";
    export const TILEMAP_JRES = "tilemap.g.jres";
    export const IMAGES_CODE = "images.g.ts";
    export const IMAGES_JRES = "images.g.jres";
    export const TUTORIAL_CODE_START = "_onCodeStart.ts";
    export const TUTORIAL_CODE_STOP = "_onCodeStop.ts";
    export const TUTORIAL_INFO_FILE = "tutorial-info-cache.json";
    export const TUTORIAL_CUSTOM_TS = "tutorial.custom.ts";
    export const BREAKPOINT_TABLET = 991; // TODO (shakao) revisit when tutorial stuff is more settled
    export const PALETTES_FILE = "_palettes.json";

    export function outputName(trg: pxtc.CompileTarget = null) {
        if (!trg) trg = appTarget.compile

        if (trg.nativeType == ts.pxtc.NATIVE_TYPE_VM) {
            if (trg.useESP)
                return trg.useUF2 ? ts.pxtc.BINARY_UF2 : ts.pxtc.BINARY_ESP
            else
                return ts.pxtc.BINARY_PXT64
        } else if (trg.useUF2 && !trg.switches.rawELF)
            return ts.pxtc.BINARY_UF2
        else if (trg.useELF)
            return ts.pxtc.BINARY_ELF
        else
            return ts.pxtc.BINARY_HEX
    }

    export function isOutputText(trg: pxtc.CompileTarget = null) {
        return outputName(trg) == ts.pxtc.BINARY_HEX
    }
}
