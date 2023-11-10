/* TODO(tslint): get rid of jquery html() calls */

/// <reference path="../built/pxtlib.d.ts" />
/// <reference path="../built/pxteditor.d.ts" />
/// <reference path="../built/pxtcompiler.d.ts" />
/// <reference path="../built/pxtblocks.d.ts" />
/// <reference path="../built/pxtsim.d.ts" />

namespace pxt.runner {
    export interface SimulateOptions {
        embedId?: string;
        id?: string;
        code?: string;
        assets?: string;
        highContrast?: boolean;
        light?: boolean;
        fullScreen?: boolean;
        dependencies?: string[];
        builtJsInfo?: pxtc.BuiltSimJsInfo;
        // single simulator frame, no message simulators
        single?: boolean;
        mute?: boolean;
        hideSimButtons?: boolean;
        autofocus?: boolean;
        additionalQueryParameters?: string;
        debug?: boolean;
        mpRole?: "server" | "client";
    }

    class EditorPackage {
        files: Map<string> = {};
        id: string;

        constructor(private ksPkg: pxt.Package, public topPkg: EditorPackage) {
        }

        getKsPkg() {
            return this.ksPkg;
        }

        getPkgId() {
            return this.ksPkg ? this.ksPkg.id : this.id;
        }

        isTopLevel() {
            return this.ksPkg && this.ksPkg.level == 0;
        }

        setFiles(files: Map<string>) {
            this.files = files;
        }

        getAllFiles() {
            return Util.mapMap(this.files, (k, f) => f)
        }
    }

    class Host
        implements pxt.Host {

        readFile(module: pxt.Package, filename: string): string {
            let epkg = getEditorPkg(module)
            return U.lookup(epkg.files, filename)
        }

        writeFile(module: pxt.Package, filename: string, contents: string): void {
            const epkg = getEditorPkg(module);
            epkg.files[filename] = contents;
        }

        getHexInfoAsync(extInfo: pxtc.ExtensionInfo): Promise<pxtc.HexInfo> {
            return pxt.hexloader.getHexInfoAsync(this, extInfo)
        }

        cacheStoreAsync(id: string, val: string): Promise<void> {
            return Promise.resolve()
        }

        cacheGetAsync(id: string): Promise<string> {
            return Promise.resolve(null as string)
        }

        patchDependencies(cfg: pxt.PackageConfig, name: string, repoId: string): boolean {
            if (!repoId) return false;
            // check that the same package hasn't been added yet
            const repo = pxt.github.parseRepoId(repoId);
            if (!repo) return false;

            for (const k of Object.keys(cfg.dependencies)) {
                const v = cfg.dependencies[k];
                const kv = pxt.github.parseRepoId(v);
                if (kv && repo.fullName == kv.fullName) {
                    if (pxt.semver.strcmp(repo.tag, kv.tag) < 0) {
                        // we have a later tag, use this one
                        cfg.dependencies[k] = repoId;
                    }
                    return true;
                }
            }

            return false;
        }

        private githubPackageCache: pxt.Map<Map<string>> = {};
        downloadPackageAsync(pkg: pxt.Package, dependencies?: string[]) {
            let proto = pkg.verProtocol()
            let cached: pxt.Map<string> = undefined;
            // cache resolve github packages
            if (proto == "github")
                cached = this.githubPackageCache[pkg._verspec];
            let epkg = getEditorPkg(pkg)

            return (cached ? Promise.resolve(cached) : pkg.commonDownloadAsync())
                .then(resp => {
                    if (resp) {
                        if (proto == "github" && !cached)
                            this.githubPackageCache[pkg._verspec] = Util.clone(resp);
                        epkg.setFiles(resp)
                        return Promise.resolve()
                    }
                    if (proto == "empty") {
                        if (Object.keys(epkg.files).length == 0) {
                            epkg.setFiles(emptyPrjFiles())
                        }
                        if (dependencies && dependencies.length) {
                            const files = getEditorPkg(pkg).files;
                            const cfg = JSON.parse(files[pxt.CONFIG_NAME]) as pxt.PackageConfig;
                            dependencies.forEach((d: string) => {
                                addPackageToConfig(cfg, d);
                            });
                            files[pxt.CONFIG_NAME] = pxt.Package.stringifyConfig(cfg);
                        }
                        return Promise.resolve()
                    } else if (proto == "docs") {
                        let files = emptyPrjFiles();
                        let cfg = JSON.parse(files[pxt.CONFIG_NAME]) as pxt.PackageConfig;
                        // load all dependencies
                        pkg.verArgument().split(',').forEach(d => {
                            if (!addPackageToConfig(cfg, d)) {
                                return;
                            }
                        });

                        if (!cfg.yotta) cfg.yotta = {};
                        cfg.yotta.ignoreConflicts = true;
                        files[pxt.CONFIG_NAME] = pxt.Package.stringifyConfig(cfg);
                        epkg.setFiles(files);
                        return Promise.resolve();
                    } else if (proto == "invalid") {
                        pxt.log(`skipping invalid pkg ${pkg.id}`);
                        return Promise.resolve();
                    } else {
                        return Promise.reject(`Cannot download ${pkg.version()}; unknown protocol`)
                    }
                })
        }
    }

    export let mainPkg: pxt.MainPackage;
    let tilemapProject: TilemapProject;

    if (!pxt.react.getTilemapProject) {
        pxt.react.getTilemapProject = () => {
            if (!tilemapProject) {
                tilemapProject = new TilemapProject();
                tilemapProject.loadPackage(mainPkg);
            }

            return tilemapProject;
        }
    }


    function addPackageToConfig(cfg: pxt.PackageConfig, dep: string) {
        let m = /^([a-zA-Z0-9_-]+)(=(.+))?$/.exec(dep);
        if (m) {
            // TODO this line seems bad, patchdependencies is on host not this?
            // looks like this should be a method in host
            if (m[3] && this && this.patchDependencies(cfg, m[1], m[3]))
                return false;
            cfg.dependencies[m[1]] = m[3] || "*"
        } else
            console.warn(`unknown package syntax ${dep}`)
        return true;
    }

    function getEditorPkg(p: pxt.Package) {
        let r: EditorPackage = (p as any)._editorPkg
        if (r) return r
        let top: EditorPackage = null
        if (p != mainPkg)
            top = getEditorPkg(mainPkg)
        let newOne = new EditorPackage(p, top)
        if (p == mainPkg)
            newOne.topPkg = newOne;
        (p as any)._editorPkg = newOne
        return newOne
    }

    function emptyPrjFiles() {
        let p = appTarget.tsprj
        let files = U.clone(p.files)
        files[pxt.CONFIG_NAME] = pxt.Package.stringifyConfig(p.config);
        files[pxt.MAIN_BLOCKS] = "";
        return files
    }

    function patchSemantic() {
        if ($ && $.fn && ($.fn as any).embed && ($.fn as any).embed.settings && ($.fn as any).embed.settings.sources && ($.fn as any).embed.settings.sources.youtube) {
            ($.fn as any).embed.settings.sources.youtube.url = '//www.youtube.com/embed/{id}?rel=0'
        }
    }

    function initInnerAsync() {
        pxt.setAppTarget((window as any).pxtTargetBundle)
        Util.assert(!!pxt.appTarget);

        const href = window.location.href;
        let force = false;
        let lang: string = undefined;
        if (/[&?]translate=1/.test(href) && !pxt.BrowserUtils.isIE()) {
            lang = ts.pxtc.Util.TRANSLATION_LOCALE;
            force = true;
            pxt.Util.enableLiveLocalizationUpdates();
        } else {
            const cookieValue = /PXT_LANG=(.*?)(?:;|$)/.exec(document.cookie);
            const mlang = /(live)?(force)?lang=([a-z]{2,}(-[A-Z]+)?)/i.exec(href);
            lang = mlang ? mlang[3] : (cookieValue && cookieValue[1] || pxt.appTarget.appTheme.defaultLocale || (navigator as any).userLanguage || navigator.language);

            const defLocale = pxt.appTarget.appTheme.defaultLocale;
            const langLowerCase = lang?.toLocaleLowerCase();
            const localDevServe = pxt.BrowserUtils.isLocalHostDev()
                && (!langLowerCase || (defLocale
                    ? defLocale.toLocaleLowerCase() === langLowerCase
                    : "en" === langLowerCase || "en-us" === langLowerCase));
            const serveLocal = pxt.BrowserUtils.isPxtElectron() || localDevServe;
            const liveTranslationsDisabled = serveLocal || pxt.appTarget.appTheme.disableLiveTranslations;
            if (!liveTranslationsDisabled || !!mlang?.[1]) {
                pxt.Util.enableLiveLocalizationUpdates();
            }
            force = !!mlang && !!mlang[2];
        }
        const versions = pxt.appTarget.versions;

        patchSemantic();
        const cfg = pxt.webConfig
        return Util.updateLocalizationAsync({
                targetId: pxt.appTarget.id,
                baseUrl: cfg.commitCdnUrl,
                code: lang,
                pxtBranch: versions ? versions.pxtCrowdinBranch : "",
                targetBranch: versions ? versions.targetCrowdinBranch : "",
                force: force,
            })
            .then(() => initHost())
    }

    export function initHost() {
        mainPkg = new pxt.MainPackage(new Host());
    }

    export function initFooter(footer: HTMLElement, shareId?: string) {
        if (!footer) return;

        let theme = pxt.appTarget.appTheme;
        let body = $('body');
        let $footer = $(footer)
        let footera = $('<a/>').attr('href', theme.homeUrl)
            .attr('target', '_blank');
        $footer.append(footera);
        if (theme.organizationLogo)
            footera.append($('<img/>').attr('src', Util.toDataUri(theme.organizationLogo)));
        else footera.append(lf("powered by {0}", theme.title));

        body.mouseenter(ev => $footer.fadeOut());
        body.mouseleave(ev => $footer.fadeIn());
    }

    export function showError(msg: string) {
        console.error(msg)
    }

    let previousMainPackage: pxt.MainPackage = undefined;
    function loadPackageAsync(id: string, code?: string, dependencies?: string[]) {
        const verspec = id ? /\w+:\w+/.test(id) ? id : "pub:" + id : "empty:tsprj";
        let host: pxt.Host;
        let downloadPackagePromise: Promise<void>;
        let installPromise: Promise<void>;
        if (previousMainPackage && previousMainPackage._verspec == verspec) {
            mainPkg = previousMainPackage;
            host = mainPkg.host();
            downloadPackagePromise = Promise.resolve();
            installPromise = Promise.resolve();
        } else {
            host = mainPkg.host();
            mainPkg = new pxt.MainPackage(host)
            mainPkg._verspec = id ? /\w+:\w+/.test(id) ? id : "pub:" + id : "empty:tsprj"
            downloadPackagePromise = host.downloadPackageAsync(mainPkg, dependencies);
            installPromise = mainPkg.installAllAsync()
            // cache previous package
            previousMainPackage = mainPkg;
        }


        return downloadPackagePromise
            .then(() => host.readFile(mainPkg, pxt.CONFIG_NAME))
            .then(str => {
                if (!str) return Promise.resolve()
                return installPromise.then(() => {
                    if (code) {
                        //Set the custom code if provided for docs.
                        let epkg = getEditorPkg(mainPkg);
                        epkg.files[pxt.MAIN_TS] = code;
                        //set the custom doc name from the URL.
                        let cfg = JSON.parse(epkg.files[pxt.CONFIG_NAME]) as pxt.PackageConfig;
                        cfg.name = window.location.href.split('/').pop().split(/[?#]/)[0];;
                        epkg.files[pxt.CONFIG_NAME] = pxt.Package.stringifyConfig(cfg);

                        //Propgate the change to main package
                        mainPkg.config.name = cfg.name;
                        if (mainPkg.config.files.indexOf(pxt.MAIN_BLOCKS) == -1) {
                            mainPkg.config.files.push(pxt.MAIN_BLOCKS);
                        }
                    }
                }).catch(e => {
                    showError(lf("Cannot load extension: {0}", e.message))
                })
            });
    }

    function getCompileOptionsAsync(hex?: boolean) {
        let trg = mainPkg.getTargetOptions()
        trg.isNative = !!hex
        trg.hasHex = !!hex
        return mainPkg.getCompileOptionsAsync(trg)
    }

    function compileAsync(hex: boolean, updateOptions?: (ops: pxtc.CompileOptions) => void) {
        return getCompileOptionsAsync(hex)
            .then(opts => {
                if (updateOptions) updateOptions(opts);
                let resp = pxtc.compile(opts)
                if (resp.diagnostics && resp.diagnostics.length > 0) {
                    resp.diagnostics.forEach(diag => {
                        console.error(diag.messageText)
                    })
                }
                return resp
            })
    }

    export function generateHexFileAsync(options: SimulateOptions): Promise<string> {
        return loadPackageAsync(options.id)
            .then(() => compileAsync(true, opts => {
                if (options.code) opts.fileSystem[pxt.MAIN_TS] = options.code;
            }))
            .then(resp => {
                if (resp.diagnostics && resp.diagnostics.length > 0) {
                    console.error("Diagnostics", resp.diagnostics)
                }
                return resp.outfiles[pxtc.BINARY_HEX];
            });
    }

    export function generateVMFileAsync(options: SimulateOptions): Promise<any> {
        pxt.setHwVariant("vm")
        return loadPackageAsync(options.id)
            .then(() => compileAsync(true, opts => {
                if (options.code) opts.fileSystem[pxt.MAIN_TS] = options.code;
            }))
            .then(resp => {
                console.log(resp)
                return resp
            })
    }

    export async function simulateAsync(container: HTMLElement, simOptions: SimulateOptions): Promise<pxtc.BuiltSimJsInfo> {
        const builtSimJS = simOptions.builtJsInfo || await fetchSimJsInfo(simOptions) || await buildSimJsInfo(simOptions);
        const { js } = builtSimJS;

        if (!js) {
            console.error("Program failed to compile");
            return undefined;
        }

        const runOptions = initDriverAndOptions(container, simOptions, builtSimJS);
        simDriver.options.messageSimulators = pxt.appTarget?.simulator?.messageSimulators;
        simDriver.options.onSimulatorCommand = msg => {
            if (msg.command === "restart") {
                runOptions.storedState = getStoredState(simOptions.id)
                simDriver.run(js, runOptions);
            }
            if (msg.command == "setstate") {
                if (msg.stateKey) {
                    setStoredState(simOptions.id, msg.stateKey, msg.stateValue)
                }
            }
        };
        if (builtSimJS.breakpoints && simOptions.debug) {
            simDriver.setBreakpoints(builtSimJS.breakpoints);
        }
        simDriver.run(js, runOptions);
        return builtSimJS;
    }

    let simDriver: pxsim.SimulatorDriver;
    // iff matches and truthy, reuse existing simdriver
    let currDriverId: string;
    function initDriverAndOptions(
        container: HTMLElement,
        simOptions: SimulateOptions,
        compileInfo?: pxtc.BuiltSimJsInfo
    ): pxsim.SimulatorRunOptions {
        if (!simDriver || !simOptions.embedId || currDriverId !== simOptions.embedId) {
            simDriver = new pxsim.SimulatorDriver(container);
            currDriverId = simOptions.embedId;
        } else {
            simDriver.container = container;
        }
        const {
            fnArgs,
            parts,
            usedBuiltinParts,
        } = compileInfo || {};
        let board = pxt.appTarget.simulator.boardDefinition;
        let storedState: Map<string> = getStoredState(simOptions.id)
        let runOptions: pxsim.SimulatorRunOptions = {
            debug: simOptions.debug,
            mute: simOptions.mute,
            boardDefinition: board,
            parts: parts,
            builtinParts: usedBuiltinParts,
            fnArgs: fnArgs,
            cdnUrl: pxt.webConfig.commitCdnUrl,
            localizedStrings: Util.getLocalizedStrings(),
            highContrast: simOptions.highContrast,
            storedState: storedState,
            light: simOptions.light,
            single: simOptions.single,
            hideSimButtons: simOptions.hideSimButtons,
            autofocus: simOptions.autofocus,
            queryParameters: simOptions.additionalQueryParameters,
            mpRole: simOptions.mpRole,
            theme: mainPkg.config?.theme,
        };
        if (pxt.appTarget.simulator && !simOptions.fullScreen)
            runOptions.aspectRatio = parts.length && pxt.appTarget.simulator.partsAspectRatio
                ? pxt.appTarget.simulator.partsAspectRatio
                : pxt.appTarget.simulator.aspectRatio;
        simDriver.setRunOptions(runOptions);
        return runOptions;
    }

    export function preloadSim(container: HTMLElement, simOpts: SimulateOptions) {
        initDriverAndOptions(container, simOpts);
        simDriver.preload(
            pxt.appTarget?.simulator?.aspectRatio || 1,
            true /** no auto run **/
        );
    }

    export function currentDriver() {
        return simDriver;
    }
    export function postSimMessage(msg: pxsim.SimulatorMessage) {
        simDriver?.postMessage(msg);
    }

    export async function fetchSimJsInfo(simOptions: SimulateOptions): Promise<pxtc.BuiltSimJsInfo> {
        try {
            return await pxt.Cloud.downloadBuiltSimJsInfoAsync(simOptions.id);
        } catch (e) {
            // This exception will happen in the majority of cases, so we don't want to log it unless for debugging.
            pxt.debug(e.toString());
            return undefined;
        }
    }

    export async function buildSimJsInfo(simOptions: SimulateOptions): Promise<pxtc.BuiltSimJsInfo> {
        await loadPackageAsync(simOptions.id, simOptions.code, simOptions.dependencies);

        let didUpgrade = false;
        const currentTargetVersion = pxt.appTarget.versions.target;
        let compileResult = await compileAsync(false, opts => {
            opts.computeUsedParts = true;

            if (simOptions.debug)
                opts.breakpoints = true;
            if (simOptions.assets) {
                const parsedAssets = JSON.parse(simOptions.assets);
                for (const key of Object.keys(parsedAssets)) {
                    const el = parsedAssets[key];
                    opts.fileSystem[key] = el;
                    if (opts.sourceFiles.indexOf(key) < 0) {
                        opts.sourceFiles.push(key);
                    }
                    if (/\.jres$/.test(key)) {
                        const parsedJres = JSON.parse(el)
                        opts.jres = pxt.inflateJRes(parsedJres, opts.jres);
                    }
                }
            }
            if (simOptions.code) opts.fileSystem[pxt.MAIN_TS] = simOptions.code;

            // Api info needed for py2ts conversion, if project is shared in Python
            if (opts.target.preferredEditor === pxt.PYTHON_PROJECT_NAME) {
                opts.target.preferredEditor = pxt.JAVASCRIPT_PROJECT_NAME;
                opts.ast = true;
                const resp = pxtc.compile(opts);
                const apis = getApiInfo(resp.ast, opts);
                opts.apisInfo = apis;
                opts.target.preferredEditor = pxt.PYTHON_PROJECT_NAME;
            }

            // Apply upgrade rules if necessary
            const sharedTargetVersion = mainPkg.config.targetVersions?.target;

            if (sharedTargetVersion && currentTargetVersion &&
                pxt.semver.cmp(pxt.semver.parse(sharedTargetVersion), pxt.semver.parse(currentTargetVersion)) < 0) {
                for (const fileName of Object.keys(opts.fileSystem)) {
                    if (!pxt.Util.startsWith(fileName, "pxt_modules") && pxt.Util.endsWith(fileName, ".ts")) {
                        didUpgrade = true;
                        opts.fileSystem[fileName] = pxt.patching.patchJavaScript(sharedTargetVersion, opts.fileSystem[fileName]);
                    }
                }
            }
        });

        if (compileResult.diagnostics?.length > 0 && didUpgrade) {
            pxt.log("Compile with upgrade rules failed, trying again with original code");
            compileResult = await compileAsync(false, opts => {
                if (simOptions.code) opts.fileSystem[pxt.MAIN_TS] = simOptions.code;
            });
        }

        if (compileResult.diagnostics && compileResult.diagnostics.length > 0) {
            console.error("Diagnostics", compileResult.diagnostics);
        }

        const res = pxtc.buildSimJsInfo(compileResult);
        res.parts = compileResult.usedParts;
        return res;
    }

    function getStoredState(id: string) {
        let storedState: Map<any> = {}
        try {
            let projectStorage = window.localStorage.getItem(id)
            if (projectStorage) {
                storedState = JSON.parse(projectStorage)
            }
        } catch (e) { }
        return storedState;
    }

    function setStoredState(id: string, key: string, value: any) {
        let storedState: Map<any> = getStoredState(id);
        if (!id) {
            return
        }

        if (value != null)
            storedState[key] = value
        else
            delete storedState[key]

        try {
            window.localStorage.setItem(id, JSON.stringify(storedState))
        } catch (e) { }
    }

    export enum LanguageMode {
        Blocks,
        TypeScript,
        Python
    }

    export let editorLanguageMode = LanguageMode.Blocks;

    export function setEditorContextAsync(mode: LanguageMode, localeInfo: string) {
        editorLanguageMode = mode;
        if (localeInfo != pxt.Util.localeInfo()) {
            const localeLiveRx = /^live-/;
            const fetchLive = localeLiveRx.test(localeInfo);
            if (fetchLive) {
                pxt.Util.enableLiveLocalizationUpdates();
            }

            return pxt.Util.updateLocalizationAsync({
                targetId: pxt.appTarget.id,
                baseUrl: pxt.webConfig.commitCdnUrl,
                code: localeInfo.replace(localeLiveRx, ''),
                pxtBranch: pxt.appTarget.versions.pxtCrowdinBranch,
                targetBranch: pxt.appTarget.versions.targetCrowdinBranch,
            });
        }

        return Promise.resolve();
    }

    function receiveDocMessage(e: MessageEvent) {
        let m = e.data as pxsim.SimulatorMessage;
        if (!m) return;
        switch (m.type) {
            case "fileloaded":
                let fm = m as pxsim.SimulatorFileLoadedMessage;
                let name = fm.name;
                let mode = LanguageMode.Blocks;
                if (/\.ts$/i.test(name)) {
                    mode = LanguageMode.TypeScript;
                }
                else if (/\.py$/i.test(name)) {
                    mode = LanguageMode.Python;
                }

                setEditorContextAsync(mode, fm.locale);
                break;
            case "popout":
                let mp = /((\/v[0-9+])\/)?[^\/]*#(doc|md):([^&?:]+)/i.exec(window.location.href);
                if (mp) {
                    const docsUrl = pxt.webConfig.docsUrl || '/--docs';
                    let verPrefix = mp[2] || '';
                    let url = mp[3] == "doc" ? (pxt.webConfig.isStatic ? `/docs${mp[4]}.html` : `${mp[4]}`) : `${docsUrl}?md=${mp[4]}`;
                    // notify parent iframe that we have completed the popout
                    if (window.parent)
                        window.parent.postMessage(<pxsim.SimulatorOpenDocMessage>{
                            type: "opendoc",
                            url: BrowserUtils.urlJoin(verPrefix, url)
                        }, "*");
                }
                break;
            case "localtoken":
                let dm = m as pxsim.SimulatorDocMessage;
                if (dm && dm.localToken) {
                    Cloud.localToken = dm.localToken;
                    pendingLocalToken.forEach(p => p());
                    pendingLocalToken = [];
                }
                break;
        }
    }

    export function startRenderServer() {
        pxt.tickEvent("renderer.ready");

        const jobQueue: pxsim.RenderBlocksRequestMessage[] = [];
        let jobPromise: Promise<void> = undefined;

        function consumeQueue() {
            if (jobPromise) return; // other worker already in action
            const msg = jobQueue.shift();
            if (!msg) return; // no more work

            const options = (msg.options || {}) as pxt.blocks.BlocksRenderOptions;
            options.splitSvg = false; // don't split when requesting rendered images
            pxt.tickEvent("renderer.job")
            const isXml = /^\s*<xml/.test(msg.code);

            const doWork = async () => {
                await pxt.BrowserUtils.loadBlocklyAsync();
                const result = isXml
                    ? await pxt.runner.compileBlocksAsync(msg.code, options)
                    : await runner.decompileSnippetAsync(msg.code, msg.options);
                const blocksSvg = result.blocksSvg as SVGSVGElement;
                const width = blocksSvg.viewBox.baseVal.width;
                const height = blocksSvg.viewBox.baseVal.height;
                const res = blocksSvg
                    ? await pxt.blocks.layout.blocklyToSvgAsync(blocksSvg, 0, 0, width, height)
                    : undefined;
                // try to render to png
                let png: string;
                try {
                    png = res
                        ? await pxt.BrowserUtils.encodeToPngAsync(res.xml, { width, height })
                        : undefined;
                } catch (e) {
                    console.warn(e);
                }
                window.parent.postMessage(<pxsim.RenderBlocksResponseMessage>{
                    source: "makecode",
                    type: "renderblocks",
                    id: msg.id,
                    width: res?.width,
                    height: res?.height,
                    svg: res?.svg,
                    uri: png || res?.xml,
                    css: res?.css
                }, "*");
            }

            jobPromise = doWork()
                .catch(e => {
                    window.parent.postMessage(<pxsim.RenderBlocksResponseMessage>{
                        source: "makecode",
                        type: "renderblocks",
                        id: msg.id,
                        error: e.message
                    }, "*");
                })
                .finally(() => {
                    jobPromise = undefined;
                    consumeQueue();
                })
        }

        pxt.editor.initEditorExtensionsAsync()
            .then(() => {
                // notify parent that render engine is loaded
                window.addEventListener("message", function (ev) {
                    const msg = ev.data as pxsim.RenderBlocksRequestMessage;
                    if (msg.type == "renderblocks") {
                        jobQueue.push(msg);
                        consumeQueue();
                    }
                }, false);
                window.parent.postMessage(<pxsim.RenderReadyResponseMessage>{
                    source: "makecode",
                    type: "renderready",
                    versions: pxt.appTarget.versions
                }, "*");
            })
    }

    export function startDocsServer(loading: HTMLElement, content: HTMLElement, backButton?: HTMLElement) {
        pxt.tickEvent("docrenderer.ready");

        const history: string[] = [];

        if (backButton) {
            backButton.addEventListener("click", () => {
                goBack();
            });
            setElementDisabled(backButton, true);
        }

        function render(doctype: string, src: string) {
            pxt.debug(`rendering ${doctype}`);
            if (backButton) $(backButton).hide()
            $(content).hide()
            $(loading).show()

            U.delay(100) // allow UI to update
                .then(() => {
                    switch (doctype) {
                        case "print":
                            const data = window.localStorage["printjob"];
                            delete window.localStorage["printjob"];
                            return renderProjectFilesAsync(content, JSON.parse(data), undefined, true)
                                .then(() => pxsim.print(1000));
                        case "project":
                            return renderProjectFilesAsync(content, JSON.parse(src))
                                .then(() => pxsim.print(1000));
                        case "projectid":
                            return renderProjectAsync(content, JSON.parse(src))
                                .then(() => pxsim.print(1000));
                        case "doc":
                            return renderDocAsync(content, src);
                        case "book":
                            return renderBookAsync(content, src);
                        default:
                            return renderMarkdownAsync(content, src);
                    }
                })
                .catch(e => {
                    $(content).html(`
                    <img style="height:4em;" src="${pxt.appTarget.appTheme.docsLogo}" />
                    <h1>${lf("Oops")}</h1>
                    <h3>${lf("We could not load the documentation, please check your internet connection.")}</h3>
                    <button class="ui button primary" id="tryagain">${lf("Try Again")}</button>`);
                    $(content).find('#tryagain').click(() => {
                        render(doctype, src);
                    })
                    // notify parent iframe that docs weren't loaded
                    if (window.parent)
                        window.parent.postMessage(<pxsim.SimulatorDocMessage>{
                            type: "docfailed",
                            docType: doctype,
                            src: src
                        }, "*");
                }).finally(() => {
                    $(loading).hide()
                    if (backButton) $(backButton).show()
                    $(content).show()
                })
                .then(() => { });
        }

        function pushHistory() {
            if (!backButton) return;

            history.push(window.location.hash);
            if (history.length > 10) {
                history.shift();
            }

            if (history.length > 1) {
                setElementDisabled(backButton, false);
            }
        }

        function goBack() {
            if (!backButton) return;
            if (history.length > 1) {
                // Top is current page
                history.pop();
                window.location.hash = history.pop();
            }

            if (history.length <= 1) {
                setElementDisabled(backButton, true);
            }
        }

        function setElementDisabled(el: HTMLElement, disabled: boolean) {
            if (disabled) {
                pxsim.U.addClass(el, "disabled");
                el.setAttribute("aria-disabled", "true");
            } else {
                pxsim.U.removeClass(el, "disabled");
                el.setAttribute("aria-disabled", "false");
            }
        }

        async function renderHashAsync() {
            let m = /^#(doc|md|tutorial|book|project|projectid|print):([^&?:]+)(:([^&?:]+):([^&?:]+))?/i.exec(window.location.hash);
            if (m) {
                pushHistory();

                if (m[4]) {
                    let mode = LanguageMode.TypeScript;
                    if (/^blocks$/i.test(m[4])) {
                        mode = LanguageMode.Blocks;
                    }
                    else if (/^python$/i.test(m[4])) {
                        mode = LanguageMode.Python;
                    }
                    await setEditorContextAsync(mode, m[5]);
                }

                // navigation occured
                render(m[1], decodeURIComponent(m[2]));
            }
        }
        let promise = pxt.editor.initEditorExtensionsAsync();
        promise.then(() => {
            window.addEventListener("message", receiveDocMessage, false);
            window.addEventListener("hashchange", () => {
                renderHashAsync();
            }, false);

            parent.postMessage({ type: "sidedocready" }, "*");

            // delay load doc page to allow simulator to load first
            setTimeout(() => renderHashAsync(), 1);
        })
    }

    export function renderProjectAsync(content: HTMLElement, projectid: string): Promise<void> {
        return Cloud.privateGetTextAsync(projectid + "/text")
            .then(txt => JSON.parse(txt))
            .then(files => renderProjectFilesAsync(content, files, projectid));
    }

    export function renderProjectFilesAsync(content: HTMLElement, files: Map<string>, projectid: string = null, escapeLinks = false): Promise<void> {
        const cfg = (JSON.parse(files[pxt.CONFIG_NAME]) || {}) as PackageConfig;

        let md = `# ${cfg.name} ${cfg.version ? cfg.version : ''}

`;
        const readme = "README.md";
        if (files[readme])
            md += files[readme].replace(/^#+/, "$0#") + '\n'; // bump all headers down 1

        cfg.files.filter(f => f != pxt.CONFIG_NAME && f != readme)
            .filter(f => matchesLanguageMode(f, editorLanguageMode))
            .forEach(f => {
                if (!/^main\.(ts|blocks)$/.test(f))
                    md += `
## ${f}
`;
                if (/\.ts$/.test(f)) {
                    md += `\`\`\`typescript
${files[f]}
\`\`\`
`;
                } else if (/\.blocks?$/.test(f)) {
                    md += `\`\`\`blocksxml
${files[f]}
\`\`\`
`;
                } else {
                    md += `\`\`\`${f.substr(f.indexOf('.'))}
${files[f]}
\`\`\`
`;
                }
            });

        const deps = cfg && cfg.dependencies && Object.keys(cfg.dependencies).filter(k => k != pxt.appTarget.corepkg);
        if (deps && deps.length) {
            md += `
## ${lf("Extensions")} #extensions

${deps.map(k => `* ${k}, ${cfg.dependencies[k]}`).join('\n')}

\`\`\`package
${deps.map(k => `${k}=${cfg.dependencies[k]}`).join('\n')}
\`\`\`
`;
        }

        if (projectid) {
            let linkString = (pxt.appTarget.appTheme.shareUrl || "https://makecode.com/") + projectid;
            if (escapeLinks) {
                // If printing the link will show up twice if it's an actual link
                linkString = "`" + linkString + "`";
            }
            md += `
${linkString}

`;
        }
        console.debug(`print md: ${md}`);
        const options: RenderMarkdownOptions = {
            print: true
        }
        return renderMarkdownAsync(content, md, options);
    }

    function matchesLanguageMode(filename: string, mode: LanguageMode) {
        switch (mode) {
            case LanguageMode.Blocks:
                return /\.blocks?$/.test(filename)
            case LanguageMode.TypeScript:
                return /\.ts?$/.test(filename)
            case LanguageMode.Python:
                return /\.py?$/.test(filename)
        }
    }

    async function renderDocAsync(content: HTMLElement, docid: string): Promise<void> {
        docid = docid.replace(/^\//, "");
        // if it fails on requesting, propagate failed promise
        const md = await pxt.Cloud.markdownAsync(docid, undefined, true /** don't suppress exception **/);
        try {
            // just log exceptions that occur during rendering,
            // similar to how normal docs handle them.
            await renderMarkdownAsync(content, md, { path: docid });
        } catch (e) {
            console.warn(e);
        }
    }

    function renderBookAsync(content: HTMLElement, summaryid: string): Promise<void> {
        summaryid = summaryid.replace(/^\//, "");
        pxt.tickEvent('book', { id: summaryid });
        pxt.log(`rendering book from ${summaryid}`)

        // display loader
        const $loader = $("#loading").find(".loader");
        $loader.addClass("text").text(lf("Compiling your book (this may take a minute)"));

        // start the work
        let toc: TOCMenuEntry[];
        return U.delay(100)
            .then(() => pxt.Cloud.markdownAsync(summaryid, undefined, true))
            .then(summary => {
                toc = pxt.docs.buildTOC(summary);
                pxt.log(`TOC: ${JSON.stringify(toc, null, 2)}`)
                const tocsp: TOCMenuEntry[] = [];
                pxt.docs.visitTOC(toc, entry => {
                    if (/^\//.test(entry.path) && !/^\/pkg\//.test(entry.path))
                        tocsp.push(entry);
                });

                return U.promisePoolAsync(4, tocsp, async entry => {
                    try {
                        const md = await pxt.Cloud.markdownAsync(entry.path, undefined, true);
                        entry.markdown = md;
                    } catch (e) {
                        entry.markdown = `_${entry.path} failed to load._`;
                    }
                });
            })
            .then(pages => {
                let md = toc[0].name;
                pxt.docs.visitTOC(toc, entry => {
                    if (entry.markdown)
                        md += '\n\n' + entry.markdown
                });
                return renderMarkdownAsync(content, md);
            })
    }

    const template = `
<aside id=button class=box>
   <a class="ui primary button" href="@ARGS@">@BODY@</a>
</aside>

<aside id=vimeo>
<div class="ui two column stackable grid container">
<div class="column">
    <div class="ui embed mdvid" data-source="vimeo" data-id="@ARGS@" data-placeholder="/thumbnail/1024/vimeo/@ARGS@" data-icon="video play">
    </div>
</div></div>
</aside>

<aside id=youtube>
<div class="ui two column stackable grid container">
<div class="column">
    <div class="ui embed mdvid" data-source="youtube" data-id="@ARGS@" data-placeholder="https://img.youtube.com/vi/@ARGS@/0.jpg">
    </div>
</div></div>
</aside>

<aside id=section>
    <!-- section @ARGS@ -->
</aside>

<aside id=hide class=box>
    <div style='display:none'>
        @BODY@
    </div>
</aside>

<aside id=avatar class=box>
    <div class='avatar @ARGS@'>
        <div class='avatar-image'></div>
        <div class='ui compact message'>
            @BODY@
        </div>
    </div>
</aside>

<aside id=hint class=box>
    <div class="ui info message">
        <div class="content">
            @BODY@
        </div>
    </div>
</aside>

<aside id=codecard class=box>
    <pre><code class="lang-codecard">@BODY@</code></pre>
</aside>

<aside id=tutorialhint class=box>
    <div class="ui hint message">
        <div class="content">
            @BODY@
        </div>
    </div>
</aside>

<aside id=reminder class=box>
    <div class="ui warning message">
        <div class="content">
            @BODY@
        </div>
    </div>
</aside>

<aside id=alert class=box>
    <div class="ui negative message">
        <div class="content">
            @BODY@
        </div>
    </div>
</aside>

<aside id=tip class=box>
    <div class="ui positive message">
        <div class="content">
            @BODY@
        </div>
    </div>
</aside>

<!-- wrapped around ordinary content -->
<aside id=main-container class=box>
    <div class="ui text">
        @BODY@
    </div>
</aside>

<!-- used for 'column' box - they are collected and wrapped in 'column-container' -->
<aside id=column class=aside>
    <div class='column'>
        @BODY@
    </div>
</aside>
<aside id=column-container class=box>
    <div class="ui three column stackable grid text">
        @BODY@
    </div>
</aside>
@breadcrumb@
@body@`;

    export interface RenderMarkdownOptions {
        path?: string;
        tutorial?: boolean;
        blocksAspectRatio?: number;
        print?: boolean; // render for print
    }

    export function renderMarkdownAsync(content: HTMLElement, md: string, options: RenderMarkdownOptions = {}): Promise<void> {
        const html = pxt.docs.renderMarkdown({
            template: template,
            markdown: md,
            theme: pxt.appTarget.appTheme
        });
        let blocksAspectRatio = options.blocksAspectRatio
            || window.innerHeight < window.innerWidth ? 1.62 : 1 / 1.62;
        $(content).html(html);
        $(content).find('a').attr('target', '_blank');
        const renderOptions = pxt.runner.defaultClientRenderOptions();
        renderOptions.tutorial = !!options.tutorial;
        renderOptions.blocksAspectRatio = blocksAspectRatio || renderOptions.blocksAspectRatio;
        renderOptions.showJavaScript = editorLanguageMode == LanguageMode.TypeScript;
        if (options.print) {
            renderOptions.showEdit = false;
            renderOptions.simulator = false;
        }

        return pxt.runner.renderAsync(renderOptions).then(() => {
            // patch a elements
            $(content).find('a[href^="/"]').removeAttr('target').each((i, a) => {
                $(a).attr('href', '#doc:' + $(a).attr('href').replace(/^\//, ''));
            });
            // enable embeds
            ($(content).find('.ui.embed') as any).embed();
        });
    }

    export interface DecompileResult {
        package: pxt.MainPackage;
        compileProgram?: ts.Program;
        compileJS?: pxtc.CompileResult;
        compileBlocks?: pxtc.CompileResult;
        compilePython?: pxtc.transpile.TranspileResult;
        apiInfo?: pxtc.ApisInfo;
        blocksSvg?: Element;
    }

    let programCache: ts.Program;
    let apiCache: pxt.Map<pxtc.ApisInfo>;

    export function decompileSnippetAsync(code: string, options?: blocks.BlocksRenderOptions): Promise<DecompileResult> {
        const { assets, forceCompilation, snippetMode, generateSourceMap } = options || {};

        // code may be undefined or empty!!!
        const packageid = options && options.packageId ? "pub:" + options.packageId :
            options && options.package ? "docs:" + options.package
                : null;
        return loadPackageAsync(packageid, code)
            .then(() => getCompileOptionsAsync(appTarget.compile ? appTarget.compile.hasHex : false))
            .then(opts => {
                // compile
                if (code)
                    opts.fileSystem[pxt.MAIN_TS] = code;
                opts.ast = true

                if (assets) {
                    for (const key of Object.keys(assets)) {
                        if (opts.sourceFiles.indexOf(key) < 0) {
                            opts.sourceFiles.push(key);
                        }
                        opts.fileSystem[key] = assets[key];
                    }
                }

                let compileJS: pxtc.CompileResult = undefined;
                let program: ts.Program;
                if (forceCompilation) {
                    compileJS = pxtc.compile(opts);
                    program = compileJS && compileJS.ast;
                } else {
                    program = pxtc.getTSProgram(opts, programCache);
                }
                programCache = program;

                // decompile to python
                let compilePython: pxtc.transpile.TranspileResult = undefined;
                if (pxt.appTarget.appTheme.python) {
                    compilePython = ts.pxtc.transpile.tsToPy(program, pxt.MAIN_TS);
                }

                // decompile to blocks
                let apis = getApiInfo(program, opts);
                return ts.pxtc.localizeApisAsync(apis, mainPkg)
                    .then(() => {
                        let blocksInfo = pxtc.getBlocksInfo(apis);
                        pxt.blocks.initializeAndInject(blocksInfo);
                        const tilemapJres = assets?.[pxt.TILEMAP_JRES];
                        const assetsJres = assets?.[pxt.IMAGES_JRES];
                        if (tilemapJres || assetsJres) {
                            tilemapProject = new TilemapProject();
                            tilemapProject.loadPackage(mainPkg);
                            if (tilemapJres)
                                tilemapProject.loadTilemapJRes(JSON.parse(tilemapJres), true);
                            if (assetsJres)
                                tilemapProject.loadAssetsJRes(JSON.parse(assetsJres))
                        }
                        let bresp = pxtc.decompiler.decompileToBlocks(
                            blocksInfo,
                            program.getSourceFile(pxt.MAIN_TS),
                            {
                                snippetMode,
                                generateSourceMap
                            });
                        if (bresp.diagnostics && bresp.diagnostics.length > 0)
                            bresp.diagnostics.forEach(diag => console.error(diag.messageText));
                        if (!bresp.success)
                            return <DecompileResult>{
                                package: mainPkg,
                                compileProgram: program,
                                compileJS,
                                compileBlocks: bresp,
                                apiInfo: apis
                            };
                        pxt.debug(bresp.outfiles[pxt.MAIN_BLOCKS])

                        const blocksSvg = pxt.blocks.render(bresp.outfiles[pxt.MAIN_BLOCKS], options);

                        if (tilemapJres || assetsJres) {
                            tilemapProject = null;
                        }

                        return <DecompileResult>{
                            package: mainPkg,
                            compileProgram: program,
                            compileJS,
                            compileBlocks: bresp,
                            compilePython,
                            apiInfo: apis,
                            blocksSvg
                        };
                    })
            });
    }

    function getApiInfo(program: ts.Program, opts: pxtc.CompileOptions) {
        if (!apiCache) apiCache = {};

        const key = Object.keys(opts.fileSystem).sort().join(";");

        if (!apiCache[key]) apiCache[key] = pxtc.getApiInfo(program, opts.jres);

        return apiCache[key];
    }

    export function compileBlocksAsync(code: string, options?: blocks.BlocksRenderOptions): Promise<DecompileResult> {
        const { assets } = options || {};

        const packageid = options && options.packageId ? "pub:" + options.packageId :
            options && options.package ? "docs:" + options.package
                : null;
        return loadPackageAsync(packageid, "")
            .then(() => getCompileOptionsAsync(appTarget.compile ? appTarget.compile.hasHex : false))
            .then(opts => {
                opts.ast = true
                if (assets) {
                    for (const key of Object.keys(assets)) {
                        if (opts.sourceFiles.indexOf(key) < 0) {
                            opts.sourceFiles.push(key);
                        }
                        opts.fileSystem[key] = assets[key];
                    }
                }
                const resp = pxtc.compile(opts)
                const apis = getApiInfo(resp.ast, opts);
                return ts.pxtc.localizeApisAsync(apis, mainPkg)
                    .then(() => {
                        const blocksInfo = pxtc.getBlocksInfo(apis);
                        pxt.blocks.initializeAndInject(blocksInfo);

                        const tilemapJres = assets?.[pxt.TILEMAP_JRES];
                        const assetsJres = assets?.[pxt.IMAGES_JRES];
                        if (tilemapJres || assetsJres) {
                            tilemapProject = new TilemapProject();
                            tilemapProject.loadPackage(mainPkg);
                            if (tilemapJres)
                                tilemapProject.loadTilemapJRes(JSON.parse(tilemapJres), true);
                            if (assetsJres)
                                tilemapProject.loadAssetsJRes(JSON.parse(assetsJres))
                        }
                        const blockSvg = pxt.blocks.render(code, options);

                        if (tilemapJres || assetsJres) {
                            tilemapProject = null;
                        }

                        return <DecompileResult>{
                            package: mainPkg,
                            blocksSvg: blockSvg,
                            apiInfo: apis
                        };
                    })
            });
    }

    let pendingLocalToken: (() => void)[] = [];

    function waitForLocalTokenAsync() {
        if (pxt.Cloud.localToken) {
            return Promise.resolve();
        }
        return new Promise<void>((resolve, reject) => {
            pendingLocalToken.push(resolve);
        });
    }

    export let initCallbacks: (() => void)[] = [];
    export function init() {
        initInnerAsync()
            .then(() => {
                for (let i = 0; i < initCallbacks.length; ++i) {
                    initCallbacks[i]();
                }
            })
    }

    function windowLoad() {
        let f = (window as any).ksRunnerWhenLoaded
        if (f) f();
    }

    windowLoad();
}
