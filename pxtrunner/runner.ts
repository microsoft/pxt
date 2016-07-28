/// <reference path="../built/pxtlib.d.ts" />
/// <reference path="../built/pxtblocks.d.ts" />
/// <reference path="../built/pxtsim.d.ts" />

namespace pxt.runner {
    export interface SimulateOptions {
        id?: string;
        code?: string;
    }

    class EditorPackage {
        files: Util.StringMap<string> = {};
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

        setFiles(files: Util.StringMap<string>) {
            this.files = files;
        }

        getAllFiles() {
            return Util.mapStringMap(this.files, (k, f) => f)
        }
    }

    class Host
        implements pxt.Host {

        readFile(module: pxt.Package, filename: string): string {
            let epkg = getEditorPkg(module)
            return U.lookup(epkg.files, filename)
        }

        writeFile(module: pxt.Package, filename: string, contents: string): void {
            if (filename == pxt.configName)
                return; // ignore config writes
            throw Util.oops("trying to write " + module + " / " + filename)
        }

        getHexInfoAsync(extInfo: ts.pxt.ExtensionInfo): Promise<any> {
            return pxt.hex.getHexInfoAsync(this, extInfo)
        }

        cacheStoreAsync(id: string, val: string): Promise<void> {
            return Promise.resolve()
        }

        cacheGetAsync(id: string): Promise<string> {
            return Promise.resolve(null as string)
        }

        downloadPackageAsync(pkg: pxt.Package) {
            let proto = pkg.verProtocol()
            let epkg = getEditorPkg(pkg)

            return pkg.commonDownloadAsync()
                .then(resp => {
                    if (resp) {
                        epkg.setFiles(resp)
                        return Promise.resolve()
                    }
                    if (proto == "empty") {
                        epkg.setFiles(emptyPrjFiles())
                        return Promise.resolve()
                    } else if (proto == "docs") {
                        let files = emptyPrjFiles();
                        let cfg = JSON.parse(files[pxt.configName]) as pxt.PackageConfig;
                        pkg.verArgument().split(',').forEach(d => cfg.dependencies[d] = "*");
                        if (!cfg.yotta) cfg.yotta = {};
                        cfg.yotta.ignoreConflicts = true;
                        files[pxt.configName] = JSON.stringify(cfg, null, 4);
                        epkg.setFiles(files);
                        return Promise.resolve();
                    } else {
                        return Promise.reject(`Cannot download ${pkg.version()}; unknown protocol`)
                    }
                })
        }

        resolveVersionAsync(pkg: pxt.Package) {
            return Cloud.privateGetAsync(pxt.pkgPrefix + pkg.id)
                .then(r => {
                    let id = (r || {})["scriptid"]
                    if (!id)
                        Util.userError(lf("cannot resolve package {0}", pkg.id))
                    return id
                })
        }
    }

    export var mainPkg: pxt.MainPackage;

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
        files[pxt.configName] = JSON.stringify(p.config, null, 4) + "\n"
        return files
    }

    function initInnerAsync() {
        let lang = /lang=([a-z]{2,}(-[A-Z]+)?)/i.exec(window.location.href);
        let cfg = pxt.webConfig
        return Util.updateLocalizationAsync(cfg.pxtCdnUrl, lang ? lang[1] : (navigator.userLanguage || navigator.language))
            .then(() => Util.httpGetJsonAsync(cfg.targetCdnUrl + "target.json"))
            .then((trgbundle: pxt.TargetBundle) => {
                pxt.appTarget = trgbundle
                mainPkg = new pxt.MainPackage(new Host());
            })
    }

    export function initFooter(footer: JQuery, shareId?: string) {
        let theme = pxt.appTarget.appTheme;
        if (footer.length == 0) return;
        let body = $('body');

        let footera = $('<a/>').attr('href', theme.homeUrl)
            .attr('target', '_blank');
        footer.append(footera);
        if (theme.organizationLogo)
            footera.append($('<img/>').attr('src', Util.toDataUri(theme.organizationLogo)));
        else footera.append(lf("powered by {0}", theme.title));

        body.mouseenter(ev => footer.fadeOut());
        body.mouseleave(ev => footer.fadeIn());
    }

    export function showError(msg: string) {
        console.error(msg)
    }

    function loadPackageAsync(id: string) {
        let host = mainPkg.host();
        mainPkg = new pxt.MainPackage(host)
        mainPkg._verspec = id ? /\w+:\w+/.test(id) ? id : "pub:" + id : "empty:tsprj"

        return host.downloadPackageAsync(mainPkg)
            .then(() => host.readFile(mainPkg, pxt.configName))
            .then(str => {
                if (!str) return Promise.resolve()
                return mainPkg.installAllAsync()
                    .catch(e => {
                        showError(lf("Cannot load package: {0}", e.message))
                    })
            });
    }

    function getCompileOptionsAsync(hex?: boolean) {
        let trg = mainPkg.getTargetOptions()
        trg.isNative = !!hex
        trg.hasHex = !!hex
        return mainPkg.getCompileOptionsAsync(trg)
    }

    function compileAsync(hex: boolean, updateOptions?: (ops: ts.pxt.CompileOptions) => void) {
        return getCompileOptionsAsync()
            .then(opts => {
                if (updateOptions) updateOptions(opts);
                let resp = ts.pxt.compile(opts)
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
                if (options.code) opts.fileSystem["main.ts"] = options.code;
            }))
            .then(resp => {
                if (resp.diagnostics && resp.diagnostics.length > 0) {
                    console.error("Diagnostics", resp.diagnostics)
                }
                return resp.outfiles[ts.pxt.BINARY_HEX];
            });
    }

    export function simulateAsync(container: HTMLElement, simOptions: SimulateOptions) {
        return loadPackageAsync(simOptions.id)
            .then(() => compileAsync(false, opts => {
                if (simOptions.code) opts.fileSystem["main.ts"] = simOptions.code;
            }))
            .then(resp => {
                if (resp.diagnostics && resp.diagnostics.length > 0) {
                    console.error("Diagnostics", resp.diagnostics)
                }
                let js = resp.outfiles[ts.pxt.BINARY_JS];
                if (js) {
                    let options: pxsim.SimulatorDriverOptions = {};
                    if (pxt.appTarget.simulator)
                        options.aspectRatio = pxt.appTarget.simulator.aspectRatio;
                    let driver = new pxsim.SimulatorDriver(container, options);
                    driver.run(js);
                }
            })
    }

    export enum LanguageMode {
        Blocks,
        TypeScript
    }

    let languageMode = LanguageMode.Blocks;
    export var onLanguageModeChanged: (mode: LanguageMode) => void = undefined;

    export function setLanguageMode(mode: LanguageMode) {
        if (mode != languageMode) {
            pxt.debug('language: ' + mode);
            languageMode = mode;
            if (onLanguageModeChanged) onLanguageModeChanged(languageMode);
        }
    }

    function receiveDocMessage(e: MessageEvent) {
        let m = e.data as pxsim.SimulatorMessage;
        if (!m) return;
        switch (m.type) {
            case "fileloaded":
                let fm = m as pxsim.SimulatorFileLoadedMessage;
                let name = fm.name;
                if (/\.ts$/i.test(name)) setLanguageMode(LanguageMode.TypeScript);
                else if (/\.blocks/i.test(name)) setLanguageMode(LanguageMode.Blocks);
        }
    }

    export function startDocsServer(loading: HTMLElement, content: HTMLElement) {
        $(loading).hide()

        function render(docid: string) {
            pxt.debug(`rendering ${docid}`);
            $(content).hide()
            $(loading).show()
            Promise.delay(100) // allow UI to update
                .then(() => renderDocAsync(content, docid))
                .finally(() => {
                    $(loading).hide()
                    $(content).show()
                })
                .done(() => { });
        }

        function renderHash() {
            let m = /^#doc:([^&?:]+)/i.exec(window.location.hash);
            if (m) {
                // navigation occured
                render(m[1]);
            }
        }

        window.addEventListener("message", receiveDocMessage, false);
        window.addEventListener("hashchange", () => {
            renderHash();
        }, false);

        renderHash();
    }

    export function renderProjectAsync(content: HTMLElement, projectid: string, template = "blocks"): Promise<void> {
        return Cloud.privateGetTextAsync(projectid + "/text")
            .then(txt => JSON.parse(txt))
            .then((files: U.Map<string>) => {
                let md = `\`\`\`${template}
${files["main.ts"]}
\`\`\``;
                return renderMarkdownAsync(content, md);
            })
    }

    function renderDocAsync(content: HTMLElement, docid: string): Promise<void> {
        docid = docid.replace(/^\//, "");
        return pxt.Cloud.privateGetTextAsync(`md/${pxt.appTarget.id}/${docid}`)
            .then(md => renderMarkdownAsync(content, md, docid))
            .catch(e => {
                pxt.reportException(e, { docid: docid });
                $(content).html(lf("<h3>Something wrong happened, please check your internet connection."));
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
    <div class="ui embed mdvid" data-source="youtube" data-id="@ARGS@" data-placeholder="https://img.youtube.com/vi/@ARGS@/hqdefault.jpg">
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
        <div class='ui message'>
            @BODY@
        </div>
    </div>
</aside>

<aside id=hint class=box>
    <div class="ui icon green message">
        <div class="content">
            <div class="header">Hint</div>
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

    export function renderMarkdownAsync(content: HTMLElement, md: string, path?: string): Promise<void> {
        const parts = (path || '').split('/');
        const bc = !path ? null : parts.map((e, i) => {
            return {
                href: "/" + parts.slice(0, i + 1).join("/"),
                name: e
            }
        })

        let html = pxt.docs.renderMarkdown(template, md, pxt.appTarget.appTheme, null, bc);
        $(content).html(html);
        $(content).find('a').attr('target', '_blank');
        return pxt.runner.renderAsync({
            blocksAspectRatio: 0.5,
            snippetClass: 'lang-blocks',
            signatureClass: 'lang-sig',
            blocksClass: 'lang-block',
            shuffleClass: 'lang-shuffle',
            simulatorClass: 'lang-sim',
            linksClass: 'lang-cards',
            namespacesClass: 'lang-namespaces',
            codeCardClass: 'lang-codecard',
            packageClass: 'lang-package',
            snippetReplaceParent: true,
            simulator: true,
            hex: true,
            hexName: pxt.appTarget.id
        }).then(() => {
            // patch a elements
            $(content).find('a[href^="/"]').removeAttr('target').each((i, a) => {
                $(a).attr('href', '#doc:' + $(a).attr('href').replace(/^\//, ''));
            })
        });
    }

    export interface DecompileResult {
        compileJS?: ts.pxt.CompileResult;
        compileBlocks?: ts.pxt.CompileResult;
        blocksSvg?: JQuery;
    }

    export function decompileToBlocksAsync(code: string, options?: blocks.BlocksRenderOptions): Promise<DecompileResult> {
        return loadPackageAsync(options && options.package ? "docs:" + options.package : null)
            .then(() => getCompileOptionsAsync(appTarget.compile ? appTarget.compile.hasHex : false))
            .then(opts => {
                // compile
                opts.fileSystem["main.ts"] = code
                opts.ast = true
                let resp = ts.pxt.compile(opts)
                if (resp.diagnostics && resp.diagnostics.length > 0)
                    resp.diagnostics.forEach(diag => console.error(diag.messageText));
                if (!resp.success)
                    return { compileJS: resp };

                // decompile to blocks
                let apis = ts.pxt.getApiInfo(resp.ast);
                let blocksInfo = ts.pxt.getBlocksInfo(apis);
                pxt.blocks.initBlocks(blocksInfo);
                let bresp = ts.pxt.decompiler.decompileToBlocks(blocksInfo, resp.ast.getSourceFile("main.ts"))
                if (bresp.diagnostics && bresp.diagnostics.length > 0)
                    bresp.diagnostics.forEach(diag => console.error(diag.messageText));
                if (!bresp.success)
                    return { compileJS: resp, compileBlocks: bresp };
                pxt.debug(bresp.outfiles["main.blocks"])
                return {
                    compileJS: resp,
                    compileBlocks: bresp,
                    blocksSvg: pxt.blocks.render(bresp.outfiles["main.blocks"], options)
                };
            })
    }

    export var initCallbacks: (() => void)[] = [];
    export function init() {
        initInnerAsync()
            .done(() => {
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