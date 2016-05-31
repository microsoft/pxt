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

            if (proto == "pub") {
                return Cloud.downloadScriptFilesAsync(pkg.verArgument())
                    .then(files => epkg.setFiles(files))
            } else if (proto == "embed") {
                epkg.setFiles(getEmbeddedScript(pkg.verArgument()))
                return Promise.resolve()
            } else if (proto == "empty") {
                epkg.setFiles(emptyPrjFiles())
                return Promise.resolve()
            } else {
                return Promise.reject(`Cannot download ${pkg.version()}; unknown protocol`)
            }
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
        mainPkg._verspec = id ? "pub:" + id : "empty:tsprj"

        return host.downloadPackageAsync(mainPkg)
            .then(() => host.readFile(mainPkg, pxt.configName))
            .then(str => {
                if (!str) return Promise.resolve()
                return mainPkg.installAllAsync()
                    .catch(e => {
                        showError(lf("Cannot load package: {0}", e.message))
                    })
            })
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

    export function startDocsServer(loading: HTMLElement, content: HTMLElement, startDocId?: string) {
        $(loading).hide()
        let currentDocId = '';
        function render(docid: string) {
            if (currentDocId == docid) {
                // don't re-render...
                return;
            }
            currentDocId = docid;
            console.log(`rendering ${docid}`);
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

        window.addEventListener("hashchange", () => {
            let m = /#doc:([^&?:]+)/i.exec(window.location.hash);
            if (m) {
                // navigation occured
                render(m[1]);
            }
        }, false);

        window.addEventListener('message', (ev: MessageEvent) => {
            let data = ev.data as pxsim.SimulatorMessage;
            switch (data.type) {
                case 'doc':
                    render((<pxsim.SimulatorDocMessage>ev.data).docid);
                    break;
            }
        });
        if (startDocId) render(startDocId);
        if (window.parent)
            window.parent.postMessage(<pxsim.SimulatorDocsReadyMessage>{ type: "docsready" }, "*");
    }

    function renderDocAsync(content: HTMLElement, docid: string): Promise<void> {
        const template = `
<aside id=youtube>
    <div class="ui embed mdvid" data-source="youtube" data-id="@ARGS@" data-placeholder="https://img.youtube.com/vi/@ARGS@/hqdefault.jpg">
    </div>
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
        <i class="help checkmark icon"></i>
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
@body@`;
        return pxt.Cloud.privateGetTextAsync(`md/${pxt.appTarget.id}/${docid.replace(/^\//, "")}`)
            .then(md => {
                let html = pxt.docs.renderMarkdown(template, md, pxt.appTarget.appTheme);
                content.innerHTML = html;
                $(content).find('a').attr('target', '_blank');
                return pxt.runner.renderAsync({
                    snippetClass: 'lang-blocks',
                    signatureClass: 'lang-sig',
                    blocksClass: 'lang-block',
                    shuffleClass: 'lang-shuffle',
                    simulatorClass: 'lang-sim',
                    linksClass: 'lang-cards',
                    namespacesClass: 'lang-namespaces',
                    codeCardClass: 'lang-codecard',
                    snippetReplaceParent: true,
                    simulator: true,
                    hex: true,
                    hexName: pxt.appTarget.id
                });
            }).finally(() => {
                // patch links
                $(content).find('a[href^="/"]').removeAttr('target').each((i, a) => {
                    $(a).attr('href', '#doc:' + $(a).attr('href').replace(/^\//, ''));
                })
            })
    }

    export interface DecompileResult {
        compileJS?: ts.pxt.CompileResult;
        compileBlocks?: ts.pxt.CompileResult;
        blocksSvg?: JQuery;
    }

    export function decompileToBlocksAsync(code: string, options?: blocks.BlocksRenderOptions): Promise<DecompileResult> {
        return loadPackageAsync(null)
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
                console.log(bresp.outfiles["main.blocks"])
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