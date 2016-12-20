/// <reference path="../built/pxtlib.d.ts" />
/// <reference path="../built/pxtblocks.d.ts" />
/// <reference path="../built/pxtsim.d.ts" />

namespace pxt.runner {
    export interface SimulateOptions {
        id?: string;
        code?: string;
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
            if (filename == pxt.CONFIG_NAME)
                return; // ignore config writes
            throw Util.oops("trying to write " + module + " / " + filename)
        }

        getHexInfoAsync(extInfo: pxtc.ExtensionInfo): Promise<pxtc.HexInfo> {
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
                        let cfg = JSON.parse(files[pxt.CONFIG_NAME]) as pxt.PackageConfig;
                        pkg.verArgument().split(',').forEach(d => {
                            let m = /^([a-zA-Z0-9_-]+)(=(.+))?$/.exec(d);
                            if (m)
                                cfg.dependencies[m[1]] = m[3] || "*"
                            else
                                console.warn(`unknown package syntax ${d}`)
                        });
                        if (!cfg.yotta) cfg.yotta = {};
                        cfg.yotta.ignoreConflicts = true;
                        files[pxt.CONFIG_NAME] = JSON.stringify(cfg, null, 4);
                        epkg.setFiles(files);
                        return Promise.resolve();
                    } else {
                        return Promise.reject(`Cannot download ${pkg.version()}; unknown protocol`)
                    }
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
        files[pxt.CONFIG_NAME] = JSON.stringify(p.config, null, 4) + "\n"
        files["main.blocks"] = "";
        return files
    }

    function patchSemantic() {
        if ($ && $.fn && $.fn.embed && $.fn.embed.settings && $.fn.embed.settings.sources && $.fn.embed.settings.sources.youtube) {
            $.fn.embed.settings.sources.youtube.url = '//www.youtube.com/embed/{id}?rel=0'
        }
    }

    function initInnerAsync() {
        pxt.setAppTarget((window as any).pxtTargetBundle)
        Util.assert(!!pxt.appTarget);

        const mlang = /(live)?lang=([a-z]{2,}(-[A-Z]+)?)/i.exec(window.location.href);
        const lang = mlang ? mlang[2] : (pxt.appTarget.appTheme.defaultLocale || navigator.userLanguage || navigator.language);
        const live = mlang && !!mlang[1];

        patchSemantic();
        const cfg = pxt.webConfig
        return Util.updateLocalizationAsync(cfg.pxtCdnUrl, lang, live)
            .then(() => {
                mainPkg = new pxt.MainPackage(new Host());
            })
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

    function loadPackageAsync(id: string, code?: string) {
        let host = mainPkg.host();
        mainPkg = new pxt.MainPackage(host)
        mainPkg._verspec = id ? /\w+:\w+/.test(id) ? id : "pub:" + id : "empty:tsprj"

        return host.downloadPackageAsync(mainPkg)
            .then(() => host.readFile(mainPkg, pxt.CONFIG_NAME))
            .then(str => {
                if (!str) return Promise.resolve()
                return mainPkg.installAllAsync().then(() => {
                    if (code) {
                        //Set the custom code if provided for docs.
                        let epkg = getEditorPkg(mainPkg);
                        epkg.files["main.ts"] = code;
                        //set the custom doc name from the URL.
                        let cfg = JSON.parse(epkg.files[pxt.CONFIG_NAME]) as pxt.PackageConfig;
                        cfg.name = window.location.href.split('/').pop().split(/[?#]/)[0];;
                        epkg.files[pxt.CONFIG_NAME] = JSON.stringify(cfg, null, 4);

                        //Propgate the change to main package
                        mainPkg.config.name = cfg.name;
                        if (mainPkg.config.files.indexOf("main.blocks") == -1) {
                            mainPkg.config.files.push("main.blocks");
                        }
                    }
                }).catch(e => {
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

    function compileAsync(hex: boolean, updateOptions?: (ops: pxtc.CompileOptions) => void) {
        return getCompileOptionsAsync()
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
                if (options.code) opts.fileSystem["main.ts"] = options.code;
            }))
            .then(resp => {
                if (resp.diagnostics && resp.diagnostics.length > 0) {
                    console.error("Diagnostics", resp.diagnostics)
                }
                return resp.outfiles[pxtc.BINARY_HEX];
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
                let js = resp.outfiles[pxtc.BINARY_JS];
                if (js) {
                    let options: pxsim.SimulatorDriverOptions = {};
                    let driver = new pxsim.SimulatorDriver(container, options);

                    let fnArgs = resp.usedArguments;
                    let board = pxt.appTarget.simulator.boardDefinition;
                    let parts = pxtc.computeUsedParts(resp, true);
                    let runOptions: pxsim.SimulatorRunOptions = {
                        boardDefinition: board,
                        parts: parts,
                        fnArgs: fnArgs
                    };
                    if (pxt.appTarget.simulator)
                        runOptions.aspectRatio = parts.length && pxt.appTarget.simulator.partsAspectRatio
                            ? pxt.appTarget.simulator.partsAspectRatio
                            : pxt.appTarget.simulator.aspectRatio;
                    driver.run(js, runOptions);
                }
            })
    }

    export enum LanguageMode {
        Blocks,
        TypeScript
    }

    export var languageMode = LanguageMode.Blocks;
    export var editorLocale = "en";

    export function setEditorContextAsync(mode: LanguageMode, locale: string) {
        languageMode = mode;
        if (locale != editorLocale) {
            const localeLiveRx = /^live-/;
            editorLocale = locale;
            return pxt.Util.updateLocalizationAsync(pxt.webConfig.pxtCdnUrl,
                editorLocale.replace(localeLiveRx, ''),
                localeLiveRx.test(editorLocale)
            );
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
                setEditorContextAsync(/\.ts$/i.test(name) ? LanguageMode.TypeScript : LanguageMode.Blocks, fm.locale).done();
                break;
            case "popout":
                let mp = /#(doc|md):([^&?:]+)/i.exec(window.location.href);
                if (mp) {
                    const docsUrl = pxt.webConfig.docsUrl || '/--docs';
                    let url = mp[1] == "doc" ? `${mp[2]}` : `${docsUrl}?md=${mp[2]}`;
                    window.open(url, "_blank");
                }
                break;
            case "localtoken":
                let dm = m as pxsim.SimulatorDocMessage;
                if (dm && dm.localToken) {
                    Cloud.localToken = dm.localToken;
                }
                break;
        }
    }

    export function startDocsServer(loading: HTMLElement, content: HTMLElement) {
        function render(doctype: string, src: string) {
            pxt.debug(`rendering ${doctype}`);
            $(content).hide()
            $(loading).show()
            Promise.delay(100) // allow UI to update
                .then(() => {
                    switch (doctype) {
                        case "doc":
                            return renderDocAsync(content, src);
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
                    $(content).show()
                })
                .done(() => { });
        }

        function renderHash() {
            let m = /^#(doc|md):([^&?:]+)(:([^&?:]+):([^&?:]+))?/i.exec(window.location.hash);
            if (m) {
                // navigation occured
                const p = m[4] ? setEditorContextAsync(
                    /^blocks$/.test(m[4]) ? LanguageMode.Blocks : LanguageMode.TypeScript,
                    m[5]) : Promise.resolve();
                p.then(() => render(m[1], decodeURIComponent(m[2])));
            }
        }

        window.addEventListener("message", receiveDocMessage, false);
        window.addEventListener("hashchange", () => {
            renderHash();
        }, false);

        parent.postMessage({ type: "sidedocready" }, "*");

        // delay load doc page to allow simulator to load first
        setTimeout(() => renderHash(), 1);
    }

    export function renderProjectAsync(content: HTMLElement, projectid: string, template = "blocks"): Promise<void> {
        return Cloud.privateGetTextAsync(projectid + "/text")
            .then(txt => JSON.parse(txt))
            .then((files: Map<string>) => {
                let md = `\`\`\`${template}
${files["main.ts"]}
\`\`\``;
                return renderMarkdownAsync(content, md);
            })
    }

    function renderDocAsync(content: HTMLElement, docid: string): Promise<void> {
        docid = docid.replace(/^\//, "");
        return pxt.Cloud.downloadMarkdownAsync(docid, editorLocale, pxt.Util.localizeLive)
            .then(md => renderMarkdownAsync(content, md, docid))
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
    <div class="ui embed mdvid" data-source="youtube" data-id="@ARGS@" data-placeholder="https://img.youtube.com/vi/@ARGS@/maxresdefault.jpg">
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
            projectClass: 'lang-project',
            snippetReplaceParent: true,
            simulator: true,
            hex: true,
            showJavaScript: languageMode == LanguageMode.TypeScript,
            hexName: pxt.appTarget.id
        }).then(() => {
            // patch a elements
            $(content).find('a[href^="/"]').removeAttr('target').each((i, a) => {
                $(a).attr('href', '#doc:' + $(a).attr('href').replace(/^\//, ''));
            });
            // enable embeds
            ($(content).find('.ui.embed') as any).embed();
        });
    }

    export interface DecompileResult {
        compileJS?: pxtc.CompileResult;
        compileBlocks?: pxtc.CompileResult;
        blocksSvg?: HTMLElement;
    }

    export function decompileToBlocksAsync(code: string, options?: blocks.BlocksRenderOptions): Promise<DecompileResult> {
        return loadPackageAsync(options && options.package ? "docs:" + options.package : null, code)
            .then(() => getCompileOptionsAsync(appTarget.compile ? appTarget.compile.hasHex : false))
            .then(opts => {
                // compile
                opts.fileSystem["main.ts"] = code;
                opts.ast = true
                let resp = pxtc.compile(opts)
                if (resp.diagnostics && resp.diagnostics.length > 0)
                    resp.diagnostics.forEach(diag => console.error(diag.messageText));
                if (!resp.success)
                    return Promise.resolve<DecompileResult>({ compileJS: resp });

                // decompile to blocks
                let apis = pxtc.getApiInfo(resp.ast);
                return ts.pxtc.localizeApisAsync(apis, mainPkg)
                    .then(() => {
                        let blocksInfo = pxtc.getBlocksInfo(apis);
                        pxt.blocks.initBlocks(blocksInfo);
                        let bresp = pxtc.decompiler.decompileToBlocks(
                            blocksInfo,
                            resp.ast.getSourceFile("main.ts"),
                            { snippetMode: options && options.snippetMode })
                        if (bresp.diagnostics && bresp.diagnostics.length > 0)
                            bresp.diagnostics.forEach(diag => console.error(diag.messageText));
                        if (!bresp.success)
                            return <DecompileResult>{ compileJS: resp, compileBlocks: bresp };
                        pxt.debug(bresp.outfiles["main.blocks"])
                        return <DecompileResult>{
                            compileJS: resp,
                            compileBlocks: bresp,
                            blocksSvg: pxt.blocks.render(bresp.outfiles["main.blocks"], options)
                        };
                    })
            });
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