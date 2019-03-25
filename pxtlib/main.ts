/// <reference path="../localtypings/pxtpackage.d.ts"/>
/// <reference path="../localtypings/pxtparts.d.ts"/>
/// <reference path="../localtypings/pxtarget.d.ts"/>
/// <reference path="util.ts"/>
/// <reference path="apptarget.ts"/>
/// <reference path="tickEvent.ts"/>

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

    export type ConversionPass = (opts: pxtc.CompileOptions) => pxtc.KsDiagnostic[]
    export let conversionPasses: ConversionPass[] = []

    export let mkTCPSocket: (host: string, port: number) => TCPIO;

    let savedAppTarget: TargetBundle;
    let savedSwitches: pxtc.CompileSwitches = {}

    export function setAppTarget(trg: TargetBundle) {
        appTarget = trg || <TargetBundle>{};
        patchAppTarget();
        savedAppTarget = U.clone(appTarget)
    }

    export function savedAppTheme(): AppTheme {
        return savedAppTarget ? savedAppTarget.appTheme : undefined;
    }

    export function setCompileSwitch(name: string, value: boolean) {
        (savedSwitches as any)[name] = value
        if (appTarget) {
            U.jsonCopyFrom(appTarget.compile.switches, savedSwitches)
            U.jsonCopyFrom(savedAppTarget.compile.switches, savedSwitches)
        }
    }

    export function setCompileSwitches(names: string) {
        if (!names)
            return
        for (let s of names.split(/[\s,;:]+/)) {
            if (s)
                setCompileSwitch(s, true)
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
        U.jsonCopyFrom(comp.switches, savedSwitches)
        // JS ref counting currently not supported
        comp.jsRefCounting = false
        if (!comp.vtableShift)
            comp.vtableShift = 2
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
        // patch logo locations
        const theme = appTarget.appTheme;
        if (theme) {
            Object.keys(theme as any as Map<string>)
                .filter(k => /(logo|hero)$/i.test(k) && /^@cdnUrl@/.test((theme as any)[k]))
                .forEach(k => (theme as any)[k] = pxt.BrowserUtils.patchCdn((theme as any)[k]));
        }

        // patching simulator images
        const sim = appTarget.simulator;
        if (sim
            && sim.boardDefinition
            && sim.boardDefinition.visual) {
            let boardDef = sim.boardDefinition.visual as pxsim.BoardImageDefinition;
            if (boardDef.image) {
                boardDef.image = pxt.BrowserUtils.patchCdn(boardDef.image)
                if (boardDef.outlineImage) boardDef.outlineImage = pxt.BrowserUtils.patchCdn(boardDef.outlineImage)
            }
        }

        // patch icons in bundled packages
        Object.keys(appTarget.bundledpkgs).forEach(pkgid => {
            const res = appTarget.bundledpkgs[pkgid];
            // path config before storing
            const config = JSON.parse(res[pxt.CONFIG_NAME]) as pxt.PackageConfig;
            if (config.icon) config.icon = pxt.BrowserUtils.patchCdn(config.icon);
            res[pxt.CONFIG_NAME] = JSON.stringify(config, null, 4);
        })

        // patch any pre-configured query url appTheme overrides
        if (appTarget.queryVariants && typeof window !== 'undefined') {
            const href = window.location.href;
            Object.keys(appTarget.queryVariants).forEach(queryRegex => {
                const regex = new RegExp(queryRegex, "i");
                const match = regex.exec(href);
                if (match) {
                    // Apply any appTheme overrides
                    let v = appTarget.queryVariants[queryRegex];
                    if (v) {
                        U.jsonMergeFrom(appTarget, v);
                    }
                }
            });
        }
    }

    export function reloadAppTargetVariant() {
        const curr = JSON.stringify(appTarget);
        appTarget = U.clone(savedAppTarget)
        if (appTargetVariant) {
            const v = appTarget.variants && appTarget.variants[appTargetVariant];
            if (v)
                U.jsonMergeFrom(appTarget, v)
            else
                U.userError(lf("Variant '{0}' not defined in pxtarget.json", appTargetVariant))
        }
        patchAppTarget();
        // check if apptarget changed
        if (onAppTargetChanged && curr != JSON.stringify(appTarget))
            onAppTargetChanged();
    }

    // this is set by compileServiceVariant in pxt.json
    export function setAppTargetVariant(variant: string, force?: boolean): void {
        pxt.debug(`app variant: ${variant}`);
        if (!force && (appTargetVariant === variant || (!appTargetVariant && !variant))) return;
        appTargetVariant = variant
        reloadAppTargetVariant();
    }

    // notify when app target was changed
    export let onAppTargetChanged: () => void;

    // This causes the `hw` package to be replaced with `hw---variant` upon package load
    // the pxt.json of hw---variant would generally specify compileServiceVariant
    // This is controlled by ?hw=variant or by configuration created by dragging `config.bin`
    // into editor.
    export function setHwVariant(variant: string) {
        variant = variant.replace(/.*---/, "")
        if (/^[\w\-]+$/.test(variant))
            hwVariant = variant
        else
            hwVariant = null
    }

    export function hasHwVariants(): boolean {
        return !!pxt.appTarget.variants
            && Object.keys(pxt.appTarget.bundledpkgs).some(pkg => /^hw---/.test(pkg));
    }

    export function getHwVariants(): PackageConfig[] {
        if (!pxt.appTarget.variants)
            return []
        let hws = Object.keys(pxt.appTarget.bundledpkgs).filter(pkg => /^hw---/.test(pkg))
        return hws.map(pkg => JSON.parse(pxt.appTarget.bundledpkgs[pkg][CONFIG_NAME]))
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

    let activityEvents: Map<number> = {};
    const tickActivityDebounced = Util.debounce(() => {
        tickEvent("activity", activityEvents);
        activityEvents = {};
    }, 10000, false);
    /**
     * Ticks activity events. This event gets aggregated and eventually gets sent.
     */
    export function tickActivity(...ids: string[]) {
        ids.filter(id => !!id).map(id => id.slice(0, 64))
            .forEach(id => activityEvents[id] = (activityEvents[id] || 0) + 1);
        tickActivityDebounced();
    }

    export interface WebConfig {
        relprefix: string; // "/beta---",
        workerjs: string;  // "/beta---worker",
        monacoworkerjs: string; // "/beta---monacoworker",
        gifworkerjs: string; // /beta---gifworker",
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
        partsUrl?: string; // /beta---parts
        runUrl?: string; // "/beta---run"
        docsUrl?: string; // "/beta---docs"
        isStatic?: boolean;
        verprefix?: string; // "v1"
    }

    export function localWebConfig() {
        let r: WebConfig = {
            relprefix: "/--",
            workerjs: "/worker.js",
            monacoworkerjs: "/monacoworker.js",
            gifworkerjs: "/gifjs/gif.worker.js",
            pxtVersion: "local",
            pxtRelId: "",
            pxtCdnUrl: "/cdn/",
            commitCdnUrl: "/cdn/",
            blobCdnUrl: "/blb/",
            cdnUrl: "/cdn/",
            targetUrl: "",
            targetVersion: "local",
            targetRelId: "",
            targetId: appTarget ? appTarget.id : "",
            simUrl: "/sim/simulator.html",
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
        downloadPackageAsync(pkg: Package): Promise<void>;
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
        header: any;
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
    export const SERIAL_EDITOR_FILE = "serial.txt"
    export const CLOUD_ID = "pxt/"
    export const BLOCKS_PROJECT_NAME = "blocksprj";
    export const JAVASCRIPT_PROJECT_NAME = "tsprj";
    export const PYTHON_PROJECT_NAME = "pyprj";

    export function outputName(trg: pxtc.CompileTarget = null) {
        if (!trg) trg = appTarget.compile
        if (trg.useUF2)
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
