/* tslint:disable:no-inner-html TODO(tslint): get rid of jquery html() calls */

/// <reference path="../built/pxtlib.d.ts" />
/// <reference path="../built/pxteditor.d.ts" />
/// <reference path="../built/pxtcompiler.d.ts" />
/// <reference path="../built/pxtblocks.d.ts" />
/// <reference path="../built/pxteditor.d.ts" />
/// <reference path="../built/pxtsim.d.ts" />

namespace pxt.runner {
    export interface SimulateOptions {
        id?: string;
        code?: string;
        highContrast?: boolean;
        light?: boolean;
        fullScreen?: boolean;
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
        downloadPackageAsync(pkg: pxt.Package) {
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
                        epkg.setFiles(emptyPrjFiles())
                        return Promise.resolve()
                    } else if (proto == "docs") {
                        let files = emptyPrjFiles();
                        let cfg = JSON.parse(files[pxt.CONFIG_NAME]) as pxt.PackageConfig;
                        // load all dependencies
                        pkg.verArgument().split(',').forEach(d => {
                            let m = /^([a-zA-Z0-9_-]+)(=(.+))?$/.exec(d);
                            if (m) {
                                if (m[3] && this.patchDependencies(cfg, m[1], m[3]))
                                    return;
                                cfg.dependencies[m[1]] = m[3] || "*"
                            } else
                                console.warn(`unknown package syntax ${d}`)
                        });

                        if (!cfg.yotta) cfg.yotta = {};
                        cfg.yotta.ignoreConflicts = true;
                        files[pxt.CONFIG_NAME] = JSON.stringify(cfg, null, 4);
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
        if ($ && $.fn && ($.fn as any).embed && ($.fn as any).embed.settings && ($.fn as any).embed.settings.sources && ($.fn as any).embed.settings.sources.youtube) {
            ($.fn as any).embed.settings.sources.youtube.url = '//www.youtube.com/embed/{id}?rel=0'
        }
    }

    function initInnerAsync() {
        pxt.setAppTarget((window as any).pxtTargetBundle)
        Util.assert(!!pxt.appTarget);

        const cookieValue = /PXT_LANG=(.*?)(?:;|$)/.exec(document.cookie);
        const mlang = /(live)?(force)?lang=([a-z]{2,}(-[A-Z]+)?)/i.exec(window.location.href);
        const lang = mlang ? mlang[3] : (cookieValue && cookieValue[1] || pxt.appTarget.appTheme.defaultLocale || (navigator as any).userLanguage || navigator.language);
        const live = !pxt.appTarget.appTheme.disableLiveTranslations || (mlang && !!mlang[1]);
        const force = !!mlang && !!mlang[2];
        const versions = pxt.appTarget.versions;

        patchSemantic();
        const cfg = pxt.webConfig
        return Util.updateLocalizationAsync(
            pxt.appTarget.id,
            cfg.commitCdnUrl, lang,
            versions ? versions.pxtCrowdinBranch : "",
            versions ? versions.targetCrowdinBranch : "",
            live,
            force)
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

    let previousMainPackage: pxt.MainPackage = undefined;
    function loadPackageAsync(id: string, code?: string) {
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
            downloadPackagePromise = host.downloadPackageAsync(mainPkg);
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
                    options.onSimulatorCommand = msg => {
                        if (msg.command === "restart") {
                            driver.run(js, runOptions);
                        }
                    };

                    let driver = new pxsim.SimulatorDriver(container, options);

                    let fnArgs = resp.usedArguments;
                    let board = pxt.appTarget.simulator.boardDefinition;
                    let parts = pxtc.computeUsedParts(resp, true);
                    let runOptions: pxsim.SimulatorRunOptions = {
                        boardDefinition: board,
                        parts: parts,
                        fnArgs: fnArgs,
                        cdnUrl: pxt.webConfig.commitCdnUrl,
                        localizedStrings: Util.getLocalizedStrings(),
                        highContrast: simOptions.highContrast,
                        light: simOptions.light
                    };
                    if (pxt.appTarget.simulator && !simOptions.fullScreen)
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

    export let editorLanguageMode = LanguageMode.Blocks;
    export let editorLocale = "en";

    export function setEditorContextAsync(mode: LanguageMode, locale: string) {
        editorLanguageMode = mode;
        if (locale != editorLocale) {
            const localeLiveRx = /^live-/;
            editorLocale = locale;
            return pxt.Util.updateLocalizationAsync(
                pxt.appTarget.id,
                pxt.webConfig.commitCdnUrl,
                editorLocale.replace(localeLiveRx, ''),
                pxt.appTarget.versions.pxtCrowdinBranch,
                pxt.appTarget.versions.targetCrowdinBranch,
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
                let mp = /((\/v[0-9+])\/)?[^\/]*#(doc|md):([^&?:]+)/i.exec(window.location.href);
                if (mp) {
                    const docsUrl = pxt.webConfig.docsUrl || '/--docs';
                    let verPrefix = mp[2] || '';
                    let url = mp[3] == "doc" ? (pxt.webConfig.isStatic ? `/docs${mp[4]}.html` : `${mp[4]}`) : `${docsUrl}?md=${mp[4]}`;
                    window.open(BrowserUtils.urlJoin(verPrefix, url), "_blank");
                    // notify parent iframe that we have completed the popout
                    if (window.parent)
                        window.parent.postMessage(<pxsim.SimulatorDocsReadyMessage>{
                            type: "popoutcomplete"
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
            jobPromise = pxt.BrowserUtils.loadBlocklyAsync()
                .then(() => runner.decompileToBlocksAsync(msg.code, msg.options))
                .then(result => {
                    const blocksSvg = result.blocksSvg as SVGSVGElement;
                    return blocksSvg ? pxt.blocks.layout.blocklyToSvgAsync(blocksSvg, 0, 0, blocksSvg.viewBox.baseVal.width, blocksSvg.viewBox.baseVal.height) : undefined;
                }).then(res => {
                    window.parent.postMessage(<pxsim.RenderBlocksResponseMessage>{
                        source: "makecode",
                        type: "renderblocks",
                        id: msg.id,
                        width: res ? res.width : undefined,
                        height: res ? res.height : undefined,
                        svg: res ? res.svg : undefined,
                        uri: res ? res.xml : undefined,
                        css: res ? res.css : undefined
                    }, "*");
                    jobPromise = undefined;
                    consumeQueue();
                })
        }

        pxt.editor.initEditorExtensionsAsync()
            .done(() => {
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
                    type: "renderready"
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
            pxsim.U.addClass(backButton, "disabled");
        }

        function render(doctype: string, src: string) {
            pxt.debug(`rendering ${doctype}`);
            if (backButton) $(backButton).hide()
            $(content).hide()
            $(loading).show()

            Promise.delay(100) // allow UI to update
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
                .done(() => { });
        }

        function pushHistory() {
            if (!backButton) return;

            history.push(window.location.hash);
            if (history.length > 10) {
                history.shift();
            }

            if (history.length > 1) {
                pxsim.U.removeClass(backButton, "disabled");
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
                pxsim.U.addClass(backButton, "disabled");
            }
        }

        function renderHash() {
            let m = /^#(doc|md|tutorial|book|project|projectid|print):([^&?:]+)(:([^&?:]+):([^&?:]+))?/i.exec(window.location.hash);
            if (m) {
                pushHistory();
                // navigation occured
                const p = m[4] ? setEditorContextAsync(
                    /^blocks$/.test(m[4]) ? LanguageMode.Blocks : LanguageMode.TypeScript,
                    m[5]) : Promise.resolve();
                p.then(() => render(m[1], decodeURIComponent(m[2])));
            }
        }
        let promise = pxt.editor.initEditorExtensionsAsync();
        promise.done(() => {
            window.addEventListener("message", receiveDocMessage, false);
            window.addEventListener("hashchange", () => {
                renderHash();
            }, false);

            parent.postMessage({ type: "sidedocready" }, "*");

            // delay load doc page to allow simulator to load first
            setTimeout(() => renderHash(), 1);
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
            .filter(f => (editorLanguageMode == LanguageMode.Blocks) == /\.blocks?$/.test(f))
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

    function renderDocAsync(content: HTMLElement, docid: string): Promise<void> {
        docid = docid.replace(/^\//, "");
        return pxt.Cloud.markdownAsync(docid, editorLocale, pxt.Util.localizeLive)
            .then(md => renderMarkdownAsync(content, md, { path: docid }))
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
        return Promise.delay(100)
            .then(() => pxt.Cloud.markdownAsync(summaryid, editorLocale, pxt.Util.localizeLive))
            .then(summary => {
                toc = pxt.docs.buildTOC(summary);
                pxt.log(`TOC: ${JSON.stringify(toc, null, 2)}`)
                const tocsp: Promise<void>[] = [];
                pxt.docs.visitTOC(toc, entry => {
                    if (!/^\//.test(entry.path) || /^\/pkg\//.test(entry.path)) return;
                    tocsp.push(
                        pxt.Cloud.markdownAsync(entry.path, editorLocale, pxt.Util.localizeLive)
                            .then(md => {
                                entry.markdown = md;
                            }, e => {
                                entry.markdown = `_${entry.path} failed to load._`;
                            })
                    )
                });
                return Promise.all(tocsp);
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
        const renderOptions: ClientRenderOptions = {
            blocksAspectRatio: blocksAspectRatio,
            snippetClass: 'lang-blocks',
            signatureClass: 'lang-sig',
            blocksClass: 'lang-block',
            blocksXmlClass: 'lang-blocksxml',
            staticPythonClass: 'lang-spy',
            simulatorClass: 'lang-sim',
            linksClass: 'lang-cards',
            namespacesClass: 'lang-namespaces',
            codeCardClass: 'lang-codecard',
            packageClass: 'lang-package',
            projectClass: 'lang-project',
            snippetReplaceParent: true,
            simulator: true,
            showEdit: true,
            hex: true,
            tutorial: !!options.tutorial,
            showJavaScript: editorLanguageMode == LanguageMode.TypeScript,
            hexName: pxt.appTarget.id
        }
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
        compilePython?: pxtc.CompileResult;
        apiInfo?: pxtc.ApisInfo;
        blocksSvg?: Element;
    }

    let programCache: ts.Program;

    export function decompileToBlocksAsync(code: string, options?: blocks.BlocksRenderOptions): Promise<DecompileResult> {
        // code may be undefined or empty!!!
        const packageid = options && options.packageId ? "pub:" + options.packageId :
            options && options.package ? "docs:" + options.package
                : null;
        return loadPackageAsync(packageid, code)
            .then(() => getCompileOptionsAsync(appTarget.compile ? appTarget.compile.hasHex : false))
            .then(opts => {
                // compile
                if (code)
                    opts.fileSystem["main.ts"] = code;
                opts.ast = true

                let compileJS: pxtc.CompileResult = undefined;
                let program: ts.Program;
                if (options && options.forceCompilation) {
                    compileJS = pxtc.compile(opts);
                    program = compileJS && compileJS.ast;
                } else {
                    program = pxtc.getTSProgram(opts, programCache);
                }
                programCache = program;

                let compilePython: pxtc.CompileResult = undefined;
                if (pxt.appTarget.appTheme.python)
                    compilePython = (pxt as any).py.decompileToPython(program, "main.ts");

                // decompile to blocks
                let apis = pxtc.getApiInfo(opts, program);
                return ts.pxtc.localizeApisAsync(apis, mainPkg)
                    .then(() => {
                        let blocksInfo = pxtc.getBlocksInfo(apis);
                        pxt.blocks.initializeAndInject(blocksInfo);
                        let bresp = pxtc.decompiler.decompileToBlocks(
                            blocksInfo,
                            program.getSourceFile("main.ts"),
                            { snippetMode: options && options.snippetMode });
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
                        pxt.debug(bresp.outfiles["main.blocks"])
                        const blocksSvg = pxt.blocks.render(bresp.outfiles["main.blocks"], options);
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

    export function compileBlocksAsync(code: string, options?: blocks.BlocksRenderOptions): Promise<DecompileResult> {
        const packageid = options && options.packageId ? "pub:" + options.packageId :
            options && options.package ? "docs:" + options.package
                : null;
        return loadPackageAsync(packageid, "")
            .then(() => getCompileOptionsAsync(appTarget.compile ? appTarget.compile.hasHex : false))
            .then(opts => {
                opts.ast = true
                const resp = pxtc.compile(opts)
                const apis = pxtc.getApiInfo(opts, resp.ast);
                return ts.pxtc.localizeApisAsync(apis, mainPkg)
                    .then(() => {
                        const blocksInfo = pxtc.getBlocksInfo(apis);
                        pxt.blocks.initializeAndInject(blocksInfo);
                        return <DecompileResult>{
                            package: mainPkg,
                            blocksSvg: pxt.blocks.render(code, options),
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
