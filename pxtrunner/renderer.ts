/* tslint:disable:no-jquery-raw-elements TODO(tslint): get rid of jquery html() calls */

namespace pxt.runner {
    const JS_ICON = "icon xicon js";
    const PY_ICON = "icon xicon python";
    const BLOCKS_ICON = "icon xicon blocks";
    const PY_FILE = "main.py";
    const BLOCKS_FILE = "main.blocks";

    export interface ClientRenderOptions {
        snippetClass?: string;
        signatureClass?: string;
        blocksClass?: string;
        blocksXmlClass?: string;
        diffBlocksXmlClass?: string;
        diffBlocksClass?: string;
        diffClass?: string;
        staticPythonClass?: string; // typescript to be converted to static python
        diffStaticPythonClass?: string; // diff between two spy snippets
        projectClass?: string;
        blocksAspectRatio?: number;
        simulatorClass?: string;
        linksClass?: string;
        namespacesClass?: string;
        apisClass?: string;
        codeCardClass?: string;
        tutorial?: boolean;
        snippetReplaceParent?: boolean;
        simulator?: boolean;
        hex?: boolean;
        hexName?: string;
        pxtUrl?: string;
        packageClass?: string;
        package?: string;
        showEdit?: boolean;
        showJavaScript?: boolean; // default is to show blocks first
        split?: boolean; // split in multiple divs if too big
    }

    export function defaultClientRenderOptions() {
        const renderOptions: ClientRenderOptions = {
            blocksAspectRatio: window.innerHeight < window.innerWidth ? 1.62 : 1 / 1.62,
            snippetClass: 'lang-blocks',
            signatureClass: 'lang-sig',
            blocksClass: 'lang-block',
            blocksXmlClass: 'lang-blocksxml',
            diffBlocksXmlClass: 'lang-diffblocksxml',
            diffClass: 'lang-diff',
            diffStaticPythonClass: 'lang-diffspy',
            diffBlocksClass: 'lang-diffblocks',
            staticPythonClass: 'lang-spy',
            simulatorClass: 'lang-sim',
            linksClass: 'lang-cards',
            namespacesClass: 'lang-namespaces',
            apisClass: 'lang-apis',
            codeCardClass: 'lang-codecard',
            packageClass: 'lang-package',
            projectClass: 'lang-project',
            snippetReplaceParent: true,
            simulator: true,
            showEdit: true,
            hex: true,
            tutorial: false,
            showJavaScript: false,
            hexName: pxt.appTarget.id
        }
        return renderOptions;
    }

    export interface WidgetOptions {
        showEdit?: boolean;
        showJs?: boolean;
        showPy?: boolean;
        hideGutter?: boolean;
        run?: boolean;
        hexname?: string;
        hex?: string;
    }

    function highlight($js: JQuery) {
        if (typeof hljs !== "undefined") {
            if ($js.hasClass("highlight")) {
                hljs.highlightBlock($js[0]);
            }
            else {
                $js.find('code.highlight').each(function (i, block) {
                    hljs.highlightBlock(block);
                });
            }
            highlightLine($js);
        }
    }

    function highlightLine($js: JQuery) {
        // apply line highlighting
        $js.find("span.hljs-comment:contains(@highlight)")
            .each((i, el) => {
                try {
                    highlightLineElement(el);
                } catch (e) {
                    pxt.reportException(e);
                }
            })
    }

    function highlightLineElement(el: Element) {
        const $el = $(el);
        const span = document.createElement("span");
        span.className = "highlight-line"

        // find new line and split text node
        let next = el.nextSibling;
        if (!next || next.nodeType != Node.TEXT_NODE) return; // end of snippet?
        let text = (next as Text).textContent;
        let inewline = text.indexOf('\n');
        if (inewline < 0)
            return; // there should have been a new line here

        // split the next node
        (next as Text).textContent = text.substring(0, inewline + 1);
        $(document.createTextNode(text.substring(inewline + 1).replace(/^\s+/, ''))).insertAfter($(next));

        // process and highlight new line
        next = next.nextSibling;
        while (next) {
            let nextnext = next.nextSibling; // before we hoist it from the tree
            if (next.nodeType == Node.TEXT_NODE) {
                text = (next as Text).textContent;
                const inewline = text.indexOf('\n');
                if (inewline < 0) {
                    span.appendChild(next);
                    next = nextnext;
                } else {
                    // we've hit the end of the line... split node in two
                    span.appendChild(document.createTextNode(text.substring(0, inewline)));
                    (next as Text).textContent = text.substring(inewline + 1);
                    break;
                }
            } else {
                span.appendChild(next);
                next = nextnext;
            }
        }

        // insert back
        $(span).insertAfter($el);
        // remove line entry
        $el.remove();
    }

    function appendBlocks($parent: JQuery, $svg: JQuery) {
        $parent.append($(`<div class="ui content blocks"/>`).append($svg));
    }

    function appendJs($parent: JQuery, $js: JQuery, woptions: WidgetOptions) {
        $parent.append($(`<div class="ui content js"><div class="subheading"><i class="ui icon xicon js"></i>JavaScript</div></div>`).append($js));
        highlight($js);
    }

    function appendPy($parent: JQuery, $py: JQuery, woptions: WidgetOptions) {
        $parent.append($(`<div class="ui content py"><div class="subheading"><i class="ui icon xicon python"></i>Python</div></div>`).append($py));
        highlight($py);
    }

    function snippetBtn(label: string, icon: string): JQuery {
        const $btn = $(`<a class="item" role="button" tabindex="0"><i role="presentation" aria-hidden="true"></i><span class="ui desktop only"></span></a>`);
        $btn.attr("aria-label", label);
        $btn.attr("title", label);
        $btn.find('i').attr("class", icon);
        $btn.find('span').text(label);

        addFireClickOnEnter($btn);
        return $btn;
    }

    function addFireClickOnEnter(el: JQuery<HTMLElement>) {
        el.keypress(e => {
            const charCode = (typeof e.which == "number") ? e.which : e.keyCode;
            if (charCode === 13 /* enter */ || charCode === 32 /* space */) {
                e.preventDefault();
                e.currentTarget.click();
            }
        });
    }

    function fillWithWidget(
        options: ClientRenderOptions,
        $container: JQuery,
        $js: JQuery,
        $py: JQuery,
        $svg: JQuery,
        decompileResult: DecompileResult,
        woptions: WidgetOptions = {}
    ) {
        let $h = $('<div class="ui bottom attached tabular icon small compact menu hideprint">'
            + ' <div class="right icon menu"></div></div>');
        let $c = $('<div class="ui top attached segment codewidget"></div>');
        let $menu = $h.find('.right.menu');

        const theme = pxt.appTarget.appTheme || {};
        if (woptions.showEdit && !theme.hideDocsEdit && decompileResult) { // edit button
            const $editBtn = snippetBtn(lf("Edit"), "edit icon");

            const { package: pkg, compileBlocks, compilePython } = decompileResult;
            const host = pkg.host();

            if ($svg && compileBlocks) {
                pkg.setPreferredEditor(pxt.BLOCKS_PROJECT_NAME);
                host.writeFile(pkg, BLOCKS_FILE, compileBlocks.outfiles[BLOCKS_FILE]);
            } else if ($py && compilePython) {
                pkg.setPreferredEditor(pxt.PYTHON_PROJECT_NAME);
                host.writeFile(pkg, PY_FILE, compileBlocks.outfiles[PY_FILE]);
            } else {
                pkg.setPreferredEditor(pxt.JAVASCRIPT_PROJECT_NAME);
            }

            const compressed = pkg.compressToFileAsync();
            $editBtn.click(() => {
                pxt.tickEvent("docs.btn", { button: "edit" });
                compressed.done(buf => {
                    window.open(`${getEditUrl(options)}/#project:${ts.pxtc.encodeBase64(Util.uint8ArrayToString(buf))}`, 'pxt');
                });
            });
            $menu.append($editBtn);
        }

        if (options.showJavaScript || (!$svg && !$py)) {
            // js
            $c.append($js);
            appendBlocksButton();
            appendPyButton();
        } else if ($svg) {
            // blocks
            $c.append($svg);
            appendJsButton();
            appendPyButton();
        } else if ($py) {
            $c.append($py);
            appendBlocksButton();
            appendJsButton();
        }

        // runner menu
        if (woptions.run && !theme.hideDocsSimulator) {
            let $runBtn = snippetBtn(lf("Run"), "play icon").click(() => {
                pxt.tickEvent("docs.btn", { button: "sim" });
                if ($c.find('.sim')[0]) {
                    $c.find('.sim').remove(); // remove previous simulators
                    scrollJQueryIntoView($c);
                } else {
                    let padding = '81.97%';
                    if (pxt.appTarget.simulator) padding = (100 / pxt.appTarget.simulator.aspectRatio) + '%';
                    const deps = options.package ? "&deps=" + encodeURIComponent(options.package) : "";
                    const url = getRunUrl(options) + "#nofooter=1" + deps;
                    const data = encodeURIComponent($js.text());
                    let $embed = $(`<div class="ui card sim"><div class="ui content"><div style="position:relative;height:0;padding-bottom:${padding};overflow:hidden;"><iframe style="position:absolute;top:0;left:0;width:100%;height:100%;" src="${url}" data-code="${data}" allowfullscreen="allowfullscreen" sandbox="allow-popups allow-forms allow-scripts allow-same-origin" frameborder="0"></iframe></div></div></div>`);
                    $c.append($embed);

                    scrollJQueryIntoView($embed);
                }
            })
            $menu.append($runBtn);
        }

        if (woptions.hexname && woptions.hex) {
            let $hexBtn = snippetBtn(lf("Download"), "download icon").click(() => {
                pxt.tickEvent("docs.btn", { button: "hex" });
                BrowserUtils.browserDownloadBinText(woptions.hex, woptions.hexname, pxt.appTarget.compile.hexMimeType);
            })
            $menu.append($hexBtn);
        }

        let r = $(`<div class=codesnippet></div>`);
        // don't add menu if empty
        if ($menu.children().length)
            r.append($h);
        r.append($c);

        // inject container
        $container.replaceWith(r);

        function appendBlocksButton() {
            if (!$svg) return;
            const $svgBtn = snippetBtn(lf("Blocks"), BLOCKS_ICON).click(() => {
                pxt.tickEvent("docs.btn", { button: "blocks" });
                if ($c.find('.blocks')[0]) {
                    $c.find('.blocks').remove();
                    scrollJQueryIntoView($c);
                } else {
                    if ($js) appendBlocks($js.parent(), $svg);
                    else appendBlocks($c, $svg);

                    scrollJQueryIntoView($svg);
                }
            })
            $menu.append($svgBtn);
        }

        function appendJsButton() {
            if (!$js) return;
            if (woptions.showJs)
                appendJs($c, $js, woptions);
            else {
                const $jsBtn = snippetBtn("JavaScript", JS_ICON).click(() => {
                    pxt.tickEvent("docs.btn", { button: "js" });
                    if ($c.find('.js')[0]) {
                        $c.find('.js').remove();
                        scrollJQueryIntoView($c);
                    } else {
                        if ($svg) appendJs($svg.parent(), $js, woptions);
                        else appendJs($c, $js, woptions);

                        scrollJQueryIntoView($js);
                    }
                })
                $menu.append($jsBtn);
            }
        }

        function appendPyButton() {
            if (!$py) return;
            if (woptions.showPy) {
                appendPy($c, $py, woptions);
            } else {
                const $pyBtn = snippetBtn("Python", PY_ICON).click(() => {
                    pxt.tickEvent("docs.btn", { button: "py" });
                    if ($c.find('.py')[0]) {
                        $c.find('.py').remove();
                        scrollJQueryIntoView($c);
                    } else {
                        if ($svg) appendPy($svg.parent(), $py, woptions);
                        else appendPy($c, $py, woptions);

                        scrollJQueryIntoView($py);
                    }
                })
                $menu.append($pyBtn);
            }
        }

        function scrollJQueryIntoView($toScrollTo: JQuery<HTMLElement>) {
            $toScrollTo[0]?.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }
    }

    let renderQueue: {
        el: JQuery;
        source: string;
        options: blocks.BlocksRenderOptions;
        render: (container: JQuery, r: pxt.runner.DecompileResult) => void;
    }[] = [];
    function consumeRenderQueueAsync(): Promise<void> {
        const existingFilters: Map<boolean> = {};
        return consumeNext()
            .then(() => {
                Blockly.Workspace.getAll().forEach(el => el.dispose());
                pxt.blocks.cleanRenderingWorkspace();
            });

        function consumeNext(): Promise<void> {
            const job = renderQueue.shift();
            if (!job) return Promise.resolve(); // done

            const { el, options, render } = job;
            return pxt.runner.decompileSnippetAsync(el.text(), options)
                .then(r => {
                    const errors = r.compileJS && r.compileJS.diagnostics && r.compileJS.diagnostics.filter(d => d.category == pxtc.DiagnosticCategory.Error);
                    if (errors && errors.length) {
                        errors.forEach(diag => pxt.reportError("docs.decompile", "" + diag.messageText, { "code": diag.code + "" }));
                    }

                    // filter out any blockly definitions from the svg that would be duplicates on the page
                    r.blocksSvg.querySelectorAll("defs *").forEach(el => {
                        if (existingFilters[el.id]) {
                            el.remove();
                        } else {
                            existingFilters[el.id] = true;
                        }
                    });
                    render(el, r);
                }, e => {
                    pxt.reportException(e);
                    el.append($('<div/>').addClass("ui segment warning").text(e.message));
                }).finally(() => {
                    el.removeClass("lang-shadow");
                    return consumeNext();
                });
        }
    }

    function renderNextSnippetAsync(cls: string,
        render: (container: JQuery, r: pxt.runner.DecompileResult) => void,
        options?: pxt.blocks.BlocksRenderOptions): Promise<void> {
        if (!cls) return Promise.resolve();

        let $el = $("." + cls).first();
        if (!$el[0]) return Promise.resolve();

        if (!options.emPixels) options.emPixels = 18;
        if (!options.layout) options.layout = pxt.blocks.BlockLayout.Align;
        options.splitSvg = true;

        renderQueue.push({ el: $el, source: $el.text(), options, render });
        $el.addClass("lang-shadow");
        $el.removeClass(cls);
        return renderNextSnippetAsync(cls, render, options);
    }

    function renderSnippetsAsync(options: ClientRenderOptions): Promise<void> {
        if (options.tutorial) {
            // don't render chrome for tutorials
            return renderNextSnippetAsync(options.snippetClass, (c, r) => {
                const s = r.blocksSvg;
                if (options.snippetReplaceParent) c = c.parent();
                const segment = $('<div class="ui segment codewidget"/>').append(s);
                c.replaceWith(segment);
            }, { package: options.package, snippetMode: false, aspectRatio: options.blocksAspectRatio });
        }

        let snippetCount = 0;
        return renderNextSnippetAsync(options.snippetClass, (c, r) => {
            const s = r.compileBlocks && r.compileBlocks.success ? $(r.blocksSvg as HTMLElement) : undefined;
            const p = r.compilePython && r.compilePython.success && r.compilePython.outfiles["main.py"];
            const js = $('<code class="lang-typescript highlight"/>').text(c.text().trim());
            const py = p ? $('<code class="lang-python highlight"/>').text(p.trim()) : undefined;
            if (options.snippetReplaceParent) c = c.parent();
            const compiled = r.compileJS && r.compileJS.success;
            // TODO should this use pxt.outputName() and not pxtc.BINARY_HEX
            const hex = options.hex && compiled && r.compileJS.outfiles[pxtc.BINARY_HEX]
                ? r.compileJS.outfiles[pxtc.BINARY_HEX] : undefined;
            const hexname = `${appTarget.nickname || appTarget.id}-${options.hexName || ''}-${snippetCount++}.hex`;
            fillWithWidget(options, c, js, py, s, r, {
                showEdit: options.showEdit,
                run: options.simulator,
                hexname: hexname,
                hex: hex,
            });
        }, { package: options.package, aspectRatio: options.blocksAspectRatio });
    }

    function decompileCallInfo(stmt: ts.Statement): pxtc.CallInfo {
        if (!stmt || stmt.kind != ts.SyntaxKind.ExpressionStatement)
            return null;

        let estmt = stmt as ts.ExpressionStatement;
        if (!estmt.expression || estmt.expression.kind != ts.SyntaxKind.CallExpression)
            return null;

        let call = estmt.expression as ts.CallExpression;
        let info = pxtc.pxtInfo(call).callInfo;

        return info;
    }

    function renderSignaturesAsync(options: ClientRenderOptions): Promise<void> {
        return renderNextSnippetAsync(options.signatureClass, (c, r) => {
            let cjs = r.compileProgram;
            if (!cjs) return;
            let file = cjs.getSourceFile("main.ts");
            let info = decompileCallInfo(file.statements[0]);
            if (!info || !r.apiInfo) return;
            const symbolInfo = r.apiInfo.byQName[info.qName];
            if (!symbolInfo) return;
            let block = Blockly.Blocks[symbolInfo.attributes.blockId];
            let xml = block?.codeCard?.blocksXml || undefined;

            const blocksHtml = xml ? pxt.blocks.render(xml) : r.compileBlocks?.success ? r.blocksSvg : undefined;
            const s = blocksHtml ? $(blocksHtml as HTMLElement) : undefined
            let jsSig = ts.pxtc.service.displayStringForSymbol(symbolInfo, /** python **/ false, r.apiInfo)
                .split("\n")[1] + ";";
            const js = $('<code class="lang-typescript highlight"/>').text(jsSig);

            const pySig = pxt.appTarget?.appTheme?.python && ts.pxtc.service.displayStringForSymbol(symbolInfo, /** python **/ true, r.apiInfo).split("\n")[1];
            const py: JQuery = pySig && $('<code class="lang-python highlight"/>').text(pySig);
            if (options.snippetReplaceParent) c = c.parent();
            // add an html widge that allows to translate the block
            if (pxt.Util.isTranslationMode()) {
                const trs = $('<div class="ui segment" />');
                trs.append($(`<div class="ui header"><i class="ui xicon globe"></i></div>`));
                if (symbolInfo.attributes.translationId)
                    trs.append($('<div class="ui message">').text(symbolInfo.attributes.translationId));
                if (symbolInfo.attributes.jsDoc)
                    trs.append($('<div class="ui message">').text(symbolInfo.attributes.jsDoc));
                trs.insertAfter(c);
            }
            fillWithWidget(options, c, js, py, s, r, { showJs: true, showPy: true, hideGutter: true });
        }, { package: options.package, snippetMode: true, aspectRatio: options.blocksAspectRatio });
    }

    function renderBlocksAsync(options: ClientRenderOptions): Promise<void> {
        return renderNextSnippetAsync(options.blocksClass, (c, r) => {
            const s = r.blocksSvg;
            if (options.snippetReplaceParent) c = c.parent();
            const segment = $('<div class="ui segment codewidget"/>').append(s);
            c.replaceWith(segment);
        }, { package: options.package, snippetMode: true, aspectRatio: options.blocksAspectRatio });
    }

    function renderStaticPythonAsync(options: ClientRenderOptions): Promise<void> {
        // Highlight python snippets if the snippet has compile python
        const woptions: WidgetOptions = {
            showEdit: !!options.showEdit,
            run: !!options.simulator
        }
        return renderNextSnippetAsync(options.staticPythonClass, (c, r) => {
            const s = r.compilePython;
            if (s && s.success) {
                const $js = c.clone().removeClass('lang-shadow').addClass('highlight');
                const $py = $js.clone().addClass('lang-python').text(s.outfiles["main.py"]);
                $js.addClass('lang-typescript');
                highlight($py);
                fillWithWidget(options, c.parent(), /* js */ $js, /* py */ $py, /* svg */ undefined, r, woptions);
            }
        }, { package: options.package, snippetMode: true });
    }

    function renderBlocksXmlAsync(opts: ClientRenderOptions): Promise<void> {
        if (!opts.blocksXmlClass) return Promise.resolve();
        const cls = opts.blocksXmlClass;
        function renderNextXmlAsync(cls: string,
            render: (container: JQuery, r: pxt.runner.DecompileResult) => void,
            options?: pxt.blocks.BlocksRenderOptions): Promise<void> {
            let $el = $("." + cls).first();
            if (!$el[0]) return Promise.resolve();

            if (!options.emPixels) options.emPixels = 18;
            options.splitSvg = true;
            return pxt.runner.compileBlocksAsync($el.text(), options)
                .then((r) => {
                    try {
                        render($el, r);
                    } catch (e) {
                        pxt.reportException(e)
                        $el.append($('<div/>').addClass("ui segment warning").text(e.message));
                    }
                    $el.removeClass(cls);
                    return Promise.delay(1, renderNextXmlAsync(cls, render, options));
                })
        }

        return renderNextXmlAsync(cls, (c, r) => {
            const s = r.blocksSvg;
            if (opts.snippetReplaceParent) c = c.parent();
            const segment = $('<div class="ui segment codewidget"/>').append(s);
            c.replaceWith(segment);
        }, { package: opts.package, snippetMode: true, aspectRatio: opts.blocksAspectRatio });
    }

    function renderDiffBlocksXmlAsync(opts: ClientRenderOptions): Promise<void> {
        if (!opts.diffBlocksXmlClass) return Promise.resolve();
        const cls = opts.diffBlocksXmlClass;
        function renderNextXmlAsync(cls: string,
            render: (container: JQuery, r: pxt.runner.DecompileResult) => void,
            options?: pxt.blocks.BlocksRenderOptions): Promise<void> {
            let $el = $("." + cls).first();
            if (!$el[0]) return Promise.resolve();

            if (!options.emPixels) options.emPixels = 18;
            options.splitSvg = true;

            const xml = $el.text().split(/-{10,}/);
            const oldXml = xml[0];
            const newXml = xml[1];

            return pxt.runner.compileBlocksAsync("", options) // force loading blocks
                .then(r => {
                    $el.removeClass(cls);
                    try {
                        const diff = pxt.blocks.diffXml(oldXml, newXml);
                        if (!diff)
                            $el.text("no changes");
                        else {
                            r.blocksSvg = diff.svg;
                            render($el, r);
                        }
                    } catch (e) {
                        pxt.reportException(e)
                        $el.append($('<div/>').addClass("ui segment warning").text(e.message));
                    }
                    return Promise.delay(1, renderNextXmlAsync(cls, render, options));
                })
        }

        return renderNextXmlAsync(cls, (c, r) => {
            const s = r.blocksSvg;
            if (opts.snippetReplaceParent) c = c.parent();
            const segment = $('<div class="ui segment codewidget"/>').append(s);
            c.replaceWith(segment);
        }, { package: opts.package, snippetMode: true, aspectRatio: opts.blocksAspectRatio });
    }


    function renderDiffAsync(opts: ClientRenderOptions): Promise<void> {
        if (!opts.diffClass) return Promise.resolve();
        const cls = opts.diffClass;
        function renderNextDiffAsync(cls: string): Promise<void> {
            let $el = $("." + cls).first();
            if (!$el[0]) return Promise.resolve();

            const { fileA: oldSrc, fileB: newSrc } = pxt.diff.split($el.text());

            try {
                const diffEl = pxt.diff.render(oldSrc, newSrc, {
                    hideLineNumbers: true,
                    hideMarkerLine: true,
                    hideMarker: true,
                    hideRemoved: true,
                    update: true,
                    ignoreWhitespace: true,
                });
                if (opts.snippetReplaceParent) $el = $el.parent();
                const segment = $('<div class="ui segment codewidget"/>').append(diffEl);
                $el.removeClass(cls);
                $el.replaceWith(segment);
            } catch (e) {
                pxt.reportException(e)
                $el.append($('<div/>').addClass("ui segment warning").text(e.message));
            }
            return Promise.delay(1, renderNextDiffAsync(cls));
        }

        return renderNextDiffAsync(cls);
    }

    function renderDiffBlocksAsync(opts: ClientRenderOptions): Promise<void> {
        if (!opts.diffBlocksClass) return Promise.resolve();
        const cls = opts.diffBlocksClass;
        function renderNextDiffAsync(cls: string): Promise<void> {
            let $el = $("." + cls).first();
            if (!$el[0]) return Promise.resolve();

            const { fileA: oldSrc, fileB: newSrc } = pxt.diff.split($el.text(), {
                removeTrailingSemiColumns: true
            });
            return Promise.mapSeries([oldSrc, newSrc], src => pxt.runner.decompileSnippetAsync(src, {
                generateSourceMap: true
            }))
                .then(resps => {
                    try {
                        const diffBlocks = pxt.blocks.decompiledDiffAsync(
                            oldSrc, resps[0].compileBlocks, newSrc, resps[1].compileBlocks, {
                            hideDeletedTopBlocks: true,
                            hideDeletedBlocks: true
                        });
                        const diffJs = pxt.diff.render(oldSrc, newSrc, {
                            hideLineNumbers: true,
                            hideMarkerLine: true,
                            hideMarker: true,
                            hideRemoved: true,
                            update: true,
                            ignoreWhitespace: true
                        })
                        let diffPy: HTMLElement;
                        const [oldPy, newPy] = resps.map(resp =>
                            resp.compilePython
                            && resp.compilePython.outfiles
                            && resp.compilePython.outfiles["main.py"]);
                        if (oldPy && newPy) {
                            diffPy = pxt.diff.render(oldPy, newPy, {
                                hideLineNumbers: true,
                                hideMarkerLine: true,
                                hideMarker: true,
                                hideRemoved: true,
                                update: true,
                                ignoreWhitespace: true
                            })
                        }
                        fillWithWidget(opts, $el.parent(), $(diffJs), diffPy && $(diffPy), $(diffBlocks.svg as HTMLElement), undefined, {
                            showEdit: false,
                            run: false,
                            hexname: undefined,
                            hex: undefined
                        });
                    } catch (e) {
                        pxt.reportException(e)
                        $el.append($('<div/>').addClass("ui segment warning").text(e.message));
                    }
                    return Promise.delay(1, renderNextDiffAsync(cls));
                })
        }

        return renderNextDiffAsync(cls);
    }

    let decompileApiPromise: Promise<DecompileResult>;
    function decompileApiAsync(options: ClientRenderOptions): Promise<DecompileResult> {
        if (!decompileApiPromise)
            decompileApiPromise = pxt.runner.decompileSnippetAsync('', options);
        return decompileApiPromise;
    }

    function renderNamespaces(options: ClientRenderOptions): Promise<void> {
        if (pxt.appTarget.id == "core") return Promise.resolve();

        return decompileApiAsync(options)
            .then((r) => {
                let res: pxt.Map<string> = {};
                const info = r.compileBlocks.blocksInfo;
                info.blocks.forEach(fn => {
                    const ns = (fn.attributes.blockNamespace || fn.namespace).split('.')[0];
                    if (!res[ns]) {
                        const nsn = info.apis.byQName[ns];
                        if (nsn && nsn.attributes.color)
                            res[ns] = nsn.attributes.color;
                    }
                });
                let nsStyleBuffer = '';
                Object.keys(res).forEach(ns => {
                    const color = res[ns] || '#dddddd';
                    nsStyleBuffer += `
                        span.docs.${ns.toLowerCase()} {
                            background-color: ${color} !important;
                            border-color: ${pxt.toolbox.fadeColor(color, 0.1, false)} !important;
                        }
                    `;
                })
                return nsStyleBuffer;
            })
            .then((nsStyleBuffer) => {
                Object.keys(pxt.toolbox.blockColors).forEach((ns) => {
                    const color = pxt.toolbox.getNamespaceColor(ns);
                    nsStyleBuffer += `
                        span.docs.${ns.toLowerCase()} {
                            background-color: ${color} !important;
                            border-color: ${pxt.toolbox.fadeColor(color, 0.1, false)} !important;
                        }
                    `;
                })
                return nsStyleBuffer;
            })
            .then((nsStyleBuffer) => {
                // Inject css
                let nsStyle = document.createElement('style');
                nsStyle.id = "namespaceColors";
                nsStyle.type = 'text/css';
                let head = document.head || document.getElementsByTagName('head')[0];
                head.appendChild(nsStyle);
                nsStyle.appendChild(document.createTextNode(nsStyleBuffer));
            });
    }

    function renderInlineBlocksAsync(options: pxt.blocks.BlocksRenderOptions): Promise<void> {
        options = Util.clone(options);
        options.emPixels = 18;
        options.snippetMode = true;

        const $els = $(`:not(pre) > code`);
        let i = 0;
        function renderNextAsync(): Promise<void> {
            if (i >= $els.length) return Promise.resolve();
            const $el = $($els[i++]);
            const text = $el.text();
            const mbtn = /^(\|+)([^\|]+)\|+$/.exec(text);
            if (mbtn) {
                const mtxt = /^(([^\:\.]*?)[\:\.])?(.*)$/.exec(mbtn[2]);
                const ns = mtxt[2] ? mtxt[2].trim().toLowerCase() : '';
                const lev = mbtn[1].length == 1 ? `docs inlinebutton ${ns}` : `docs inlineblock ${ns}`;
                const txt = mtxt[3].trim();
                $el.replaceWith($(`<span class="${lev}"/>`).text(U.rlf(txt)));
                return renderNextAsync();
            }

            const m = /^\[([^\]]+)\]$/.exec(text);
            if (!m) return renderNextAsync();

            const code = m[1];
            return pxt.runner.decompileSnippetAsync(code, options)
                .then(r => {
                    if (r.blocksSvg) {
                        let $newel = $('<span class="block"/>').append(r.blocksSvg);
                        const file = r.compileProgram.getSourceFile("main.ts");
                        const stmt = file.statements[0];
                        const info = decompileCallInfo(stmt);
                        if (info && r.apiInfo) {
                            const symbolInfo = r.apiInfo.byQName[info.qName];
                            if (symbolInfo && symbolInfo.attributes.help) {
                                $newel = $(`<a class="ui link"/>`).attr("href", `/reference/${symbolInfo.attributes.help}`).append($newel);
                            }
                        }
                        $el.replaceWith($newel);
                    }
                    return Promise.delay(1, renderNextAsync());
                });
        }

        return renderNextAsync();
    }

    function renderProjectAsync(options: ClientRenderOptions): Promise<void> {
        if (!options.projectClass) return Promise.resolve();

        function render(): Promise<void> {
            let $el = $("." + options.projectClass).first();
            let e = $el[0];
            if (!e) return Promise.resolve();

            $el.removeClass(options.projectClass);

            let id = pxt.Cloud.parseScriptId(e.innerText);
            if (id) {
                if (options.snippetReplaceParent) {
                    e = e.parentElement;
                    // create a new div to host the rendered code
                    let d = document.createElement("div");
                    e.parentElement.insertBefore(d, e);
                    e.parentElement.removeChild(e);

                    e = d;
                }
                return pxt.runner.renderProjectAsync(e, id)
                    .then(() => render());
            }
            else return render();
        }

        return render();
    }

    function renderApisAsync(options: ClientRenderOptions, replaceParent: boolean): Promise<void> {
        const cls = options.apisClass;
        if (!cls) return Promise.resolve();

        const apisEl = $('.' + cls);
        if (!apisEl.length) return Promise.resolve();

        return decompileApiAsync(options)
            .then((r) => {
                const info = r.compileBlocks.blocksInfo;
                const symbols = pxt.Util.values(info.apis.byQName)
                    .filter(symbol => !symbol.attributes.hidden && !!symbol.attributes.jsDoc && !/^__/.test(symbol.name));
                apisEl.each((i, e) => {
                    let c = $(e);
                    const namespaces = pxt.Util.toDictionary(c.text().split('\n'), n => n); // list of namespace to list apis for.
                    const csymbols = symbols.filter(symbol => !!namespaces[symbol.namespace])
                    if (!csymbols.length) return;

                    csymbols.sort((l,r) => {
                        // render cards first
                        const lcard = !l.attributes.blockHidden && Blockly.Blocks[l.attributes.blockId];
                        const rcard = !r.attributes.blockHidden && Blockly.Blocks[r.attributes.blockId]
                        if (!!lcard != !!rcard) return -(lcard ? 1 : 0) + (rcard ? 1 : 0);

                        // sort alphabetically
                        return l.name.localeCompare(r.name);
                    })

                    const ul = $('<div />').addClass('ui divided items');
                    ul.attr("role", "listbox");
                    csymbols.forEach(symbol => addSymbolCardItem(ul, symbol, "item"));
                    if (replaceParent) c = c.parent();
                    c.replaceWith(ul)
                })
            });
    }

    function addCardItem(ul: JQuery, card: pxt.CodeCard) {
        if (!card) return;
        const mC = /^\/(v\d+)/.exec(card.url);
        const mP = /^\/(v\d+)/.exec(window.location.pathname);
        const inEditor = /#doc/i.test(window.location.href);
        if (card.url && !mC && mP && !inEditor) card.url = `/${mP[1]}/${card.url}`;
        ul.append(pxt.docs.codeCard.render(card, { hideHeader: true, shortName: true }));
    }

    function addSymbolCardItem(ul: JQuery, symbol: pxtc.SymbolInfo, cardStyle?: string) {
        const attributes = symbol.attributes;
        const block = !attributes.blockHidden && Blockly.Blocks[attributes.blockId];
        const card = block?.codeCard;
        if (card) {
            const ccard = U.clone(block.codeCard) as pxt.CodeCard;
            if (cardStyle) ccard.style = cardStyle;
            addCardItem(ul, ccard);
        }
        else {
            // default to text
            // no block available here
            addCardItem(ul, {
                name: symbol.qName,
                description: attributes.jsDoc,
                url: attributes.help || undefined,
                style: cardStyle
            })
        }
    }

    function renderLinksAsync(options: ClientRenderOptions, cls: string, replaceParent: boolean, ns: boolean): Promise<void> {
        return renderNextSnippetAsync(cls, (c, r) => {
            const cjs = r.compileProgram;
            if (!cjs) return;
            const file = cjs.getSourceFile("main.ts");
            const stmts = file.statements.slice(0);
            const ul = $('<div />').addClass('ui cards');
            ul.attr("role", "listbox");
            stmts.forEach(stmt => {
                const kind = stmt.kind;
                const info = decompileCallInfo(stmt);
                if (info && r.apiInfo && r.apiInfo.byQName[info.qName]) {
                    const symbol = r.apiInfo.byQName[info.qName];
                    const attributes = symbol.attributes;
                    const block = Blockly.Blocks[attributes.blockId];
                    if (ns) {
                        const ii = symbol;
                        const nsi = r.compileBlocks.blocksInfo.apis.byQName[ii.namespace];
                        addCardItem(ul, {
                            name: nsi.attributes.blockNamespace || nsi.name,
                            url: nsi.attributes.help || ("reference/" + (nsi.attributes.blockNamespace || nsi.name).toLowerCase()),
                            description: nsi.attributes.jsDoc,
                            blocksXml: block && block.codeCard
                                ? block.codeCard.blocksXml
                                : attributes.blockId
                                    ? `<xml xmlns="http://www.w3.org/1999/xhtml"><block type="${attributes.blockId}"></block></xml>`
                                    : undefined
                        })
                    } else {
                        addSymbolCardItem(ul, symbol);
                    }
                } else
                    switch (kind) {
                        case ts.SyntaxKind.ExpressionStatement: {
                            const es = stmt as ts.ExpressionStatement;
                            switch (es.expression.kind) {
                                case ts.SyntaxKind.TrueKeyword:
                                case ts.SyntaxKind.FalseKeyword:
                                    addCardItem(ul, {
                                        name: "Boolean",
                                        url: "blocks/logic/boolean",
                                        description: lf("True or false values"),
                                        blocksXml: '<xml xmlns="http://www.w3.org/1999/xhtml"><block type="logic_boolean"><field name="BOOL">TRUE</field></block></xml>'
                                    });
                                    break;
                                default:
                                    pxt.debug(`card expr kind: ${es.expression.kind}`);
                                    break;
                            }
                            break;
                        }
                        case ts.SyntaxKind.IfStatement:
                            addCardItem(ul, {
                                name: ns ? "Logic" : "if",
                                url: "blocks/logic" + (ns ? "" : "/if"),
                                description: ns ? lf("Logic operators and constants") : lf("Conditional statement"),
                                blocksXml: '<xml xmlns="http://www.w3.org/1999/xhtml"><block type="controls_if"></block></xml>'
                            });
                            break;
                        case ts.SyntaxKind.WhileStatement:
                            addCardItem(ul, {
                                name: ns ? "Loops" : "while",
                                url: "blocks/loops" + (ns ? "" : "/while"),
                                description: ns ? lf("Loops and repetition") : lf("Repeat code while a condition is true."),
                                blocksXml: '<xml xmlns="http://www.w3.org/1999/xhtml"><block type="device_while"></block></xml>'
                            });
                            break;
                        case ts.SyntaxKind.ForOfStatement:
                            addCardItem(ul, {
                                name: ns ? "Loops" : "for of",
                                url: "blocks/loops" + (ns ? "" : "/for-of"),
                                description: ns ? lf("Loops and repetition") : lf("Repeat code for each item in a list."),
                                blocksXml: '<xml xmlns="http://www.w3.org/1999/xhtml"><block type="controls_for_of"></block></xml>'
                            });
                            break;
                        case ts.SyntaxKind.BreakStatement:
                            addCardItem(ul, {
                                name: ns ? "Loops" : "break",
                                url: "blocks/loops" + (ns ? "" : "/break"),
                                description: ns ? lf("Loops and repetition") : lf("Break out of the current loop."),
                                blocksXml: '<xml xmlns="http://www.w3.org/1999/xhtml"><block type="break_keyword"></block></xml>'
                            });
                            break;
                        case ts.SyntaxKind.ContinueStatement:
                            addCardItem(ul, {
                                name: ns ? "Loops" : "continue",
                                url: "blocks/loops" + (ns ? "" : "/continue"),
                                description: ns ? lf("Loops and repetition") : lf("Skip iteration and continue the current loop."),
                                blocksXml: '<xml xmlns="http://www.w3.org/1999/xhtml"><block type="continue_keyboard"></block></xml>'
                            });
                            break;
                        case ts.SyntaxKind.ForStatement: {
                            let fs = stmt as ts.ForStatement;
                            // look for the 'repeat' loop style signature in the condition expression, explicitly: (let i = 0; i < X; i++)
                            // for loops will have the '<=' conditional.
                            let forloop = true;
                            if (fs.condition.getChildCount() == 3) {
                                forloop = !(fs.condition.getChildAt(0).getText() == "0" ||
                                    fs.condition.getChildAt(1).kind == ts.SyntaxKind.LessThanToken);
                            }
                            if (forloop) {
                                addCardItem(ul, {
                                    name: ns ? "Loops" : "for",
                                    url: "blocks/loops" + (ns ? "" : "/for"),
                                    description: ns ? lf("Loops and repetition") : lf("Repeat code for a given number of times using an index."),
                                    blocksXml: '<xml xmlns="http://www.w3.org/1999/xhtml"><block type="controls_simple_for"></block></xml>'
                                });
                            } else {
                                addCardItem(ul, {
                                    name: ns ? "Loops" : "repeat",
                                    url: "blocks/loops" + (ns ? "" : "/repeat"),
                                    description: ns ? lf("Loops and repetition") : lf("Repeat code for a given number of times."),
                                    blocksXml: '<xml xmlns="http://www.w3.org/1999/xhtml"><block type="controls_repeat_ext"></block></xml>'
                                });
                            }
                            break;
                        }
                        case ts.SyntaxKind.VariableStatement:
                            addCardItem(ul, {
                                name: ns ? "Variables" : "variable declaration",
                                url: "blocks/variables" + (ns ? "" : "/assign"),
                                description: ns ? lf("Variables") : lf("Assign a value to a named variable."),
                                blocksXml: '<xml xmlns="http://www.w3.org/1999/xhtml"><block type="variables_set"></block></xml>'
                            });
                            break;
                        default:
                            pxt.debug(`card kind: ${kind}`)
                    }
            })

            if (replaceParent) c = c.parent();
            c.replaceWith(ul)
        }, { package: options.package, aspectRatio: options.blocksAspectRatio })
    }

    function fillCodeCardAsync(c: JQuery, cards: pxt.CodeCard[], options: pxt.docs.codeCard.CodeCardRenderOptions): Promise<void> {
        if (!cards || cards.length == 0) return Promise.resolve();

        if (cards.length == 0) {
            let cc = pxt.docs.codeCard.render(cards[0], options)
            c.replaceWith(cc);
        } else {
            let cd = document.createElement("div")
            cd.className = "ui cards";
            cd.setAttribute("role", "listbox")
            cards.forEach(card => {
                // patch card url with version if necessary, we don't do this in the editor because that goes through the backend and passes the targetVersion then
                const mC = /^\/(v\d+)/.exec(card.url);
                const mP = /^\/(v\d+)/.exec(window.location.pathname);
                const inEditor = /#doc/i.test(window.location.href);
                if (card.url && !mC && mP && !inEditor) card.url = `/${mP[1]}${card.url}`;
                const cardEl = pxt.docs.codeCard.render(card, options);
                cd.appendChild(cardEl)
                // automitcally display package icon for approved packages
                if (card.cardType == "package") {
                    const repoId = pxt.github.parseRepoId((card.url || "").replace(/^\/pkg\//, ''));
                    if (repoId) {
                        pxt.packagesConfigAsync()
                            .then(pkgConfig => {
                                const status = pxt.github.repoStatus(repoId, pkgConfig);
                                switch (status) {
                                    case pxt.github.GitRepoStatus.Banned:
                                        cardEl.remove(); break;
                                    case pxt.github.GitRepoStatus.Approved:
                                        // update card info
                                        card.imageUrl = pxt.github.mkRepoIconUrl(repoId);
                                        // inject
                                        cd.insertBefore(pxt.docs.codeCard.render(card, options), cardEl);
                                        cardEl.remove();
                                        break;
                                }
                            })
                            .catch(e => {
                                // swallow
                                pxt.reportException(e);
                                pxt.debug(`failed to load repo ${card.url}`)
                            })
                    }
                }
            });
            c.replaceWith(cd);
        }

        return Promise.resolve();
    }

    function renderNextCodeCardAsync(cls: string, options: ClientRenderOptions): Promise<void> {
        if (!cls) return Promise.resolve();

        let $el = $("." + cls).first();
        if (!$el[0]) return Promise.resolve();

        $el.removeClass(cls);
        let cards: pxt.CodeCard[];
        try {
            let js: any = JSON.parse($el.text());
            if (!Array.isArray(js)) js = [js];
            cards = js as pxt.CodeCard[];
        } catch (e) {
            pxt.reportException(e);
            $el.append($('<div/>').addClass("ui segment warning").text(e.messageText));
        }

        if (options.snippetReplaceParent) $el = $el.parent();
        return fillCodeCardAsync($el, cards, { hideHeader: true })
            .then(() => Promise.delay(1, renderNextCodeCardAsync(cls, options)));
    }

    function getRunUrl(options: ClientRenderOptions): string {
        return options.pxtUrl ? options.pxtUrl + '/--run' : pxt.webConfig && pxt.webConfig.runUrl ? pxt.webConfig.runUrl : '/--run';
    }

    function getEditUrl(options: ClientRenderOptions): string {
        const url = options.pxtUrl || pxt.appTarget.appTheme.homeUrl;
        return (url || "").replace(/\/$/, '');
    }

    function mergeConfig(options: ClientRenderOptions) {
        // additional config options
        if (!options.packageClass) return;
        $('.' + options.packageClass).each((i, c) => {
            let $c = $(c);
            let name = $c.text().split('\n').map(s => s.replace(/\s*/g, '')).filter(s => !!s).join(',');
            options.package = options.package ? `${options.package},${name}` : name;
            if (options.snippetReplaceParent) $c = $c.parent();
            $c.remove();
        });
        $('.lang-config').each((i, c) => {
            let $c = $(c);
            if (options.snippetReplaceParent) $c = $c.parent();
            $c.remove();
        })
    }

    function renderDirectPython(options?: ClientRenderOptions) {
        // Highlight python snippets written with the ```python
        // language tag (as opposed to the ```spy tag, see renderStaticPythonAsync for that)
        const woptions: WidgetOptions = {
            showEdit: !!options.showEdit,
            run: !!options.simulator
        }

        function render(e: HTMLElement, ignored: boolean) {
            if (typeof hljs !== "undefined") {
                $(e).text($(e).text().replace(/^\s*\r?\n/, ''))
                hljs.highlightBlock(e)
                highlightLine($(e));
            }
            const opts = pxt.U.clone(woptions);
            if (ignored) {
                opts.run = false;
                opts.showEdit = false;
            }
            fillWithWidget(options, $(e).parent(), $(e), /* py */ undefined, /* JQuery */ undefined, /* decompileResult */ undefined, opts);
        }

        $('code.lang-python').each((i, e) => {
            render(e, false);
            $(e).removeClass('lang-python');
        });
    }

    function renderTypeScript(options?: ClientRenderOptions) {
        const woptions: WidgetOptions = {
            showEdit: !!options.showEdit,
            run: !!options.simulator
        }

        function render(e: HTMLElement, ignored: boolean) {
            if (typeof hljs !== "undefined") {
                $(e).text($(e).text().replace(/^\s*\r?\n/, ''))
                hljs.highlightBlock(e)
                highlightLine($(e));
            }
            const opts = pxt.U.clone(woptions);
            if (ignored) {
                opts.run = false;
                opts.showEdit = false;
            }
            fillWithWidget(options, $(e).parent(), $(e), /* py */ undefined, /* JQuery */ undefined, /* decompileResult */ undefined, opts);
        }

        $('code.lang-typescript').each((i, e) => {
            render(e, false);
            $(e).removeClass('lang-typescript');
        });
        $('code.lang-typescript-ignore').each((i, e) => {
            $(e).removeClass('lang-typescript-ignore');
            $(e).addClass('lang-typescript');
            render(e, true);
            $(e).removeClass('lang-typescript');
        });
        $('code.lang-typescript-invalid').each((i, e) => {
            $(e).removeClass('lang-typescript-invalid');
            $(e).addClass('lang-typescript');
            render(e, true);
            $(e).removeClass('lang-typescript');
            $(e).parent('div').addClass('invalid');
            $(e).parent('div').prepend($("<i>", { "class": "icon ban" }));
            $(e).addClass('invalid');
        });
        $('code.lang-typescript-valid').each((i, e) => {
            $(e).removeClass('lang-typescript-valid');
            $(e).addClass('lang-typescript');
            render(e, true);
            $(e).removeClass('lang-typescript');
            $(e).parent('div').addClass('valid');
            $(e).parent('div').prepend($("<i>", { "class": "icon check" }));
            $(e).addClass('valid');
        });
    }

    function renderGhost(options: ClientRenderOptions) {
        let c = $('code.lang-ghost');
        if (options.snippetReplaceParent)
            c = c.parent();
        c.remove();
    }

    function renderSims(options: ClientRenderOptions) {
        if (!options.simulatorClass) return;
        // simulators
        $('.' + options.simulatorClass).each((i, c) => {
            let $c = $(c);
            let padding = '81.97%';
            if (pxt.appTarget.simulator) padding = (100 / pxt.appTarget.simulator.aspectRatio) + '%';
            let $sim = $(`<div class="ui card"><div class="ui content">
                    <div style="position:relative;height:0;padding-bottom:${padding};overflow:hidden;">
                    <iframe style="position:absolute;top:0;left:0;width:100%;height:100%;" allowfullscreen="allowfullscreen" frameborder="0" sandbox="allow-popups allow-forms allow-scripts allow-same-origin"></iframe>
                    </div>
                    </div></div>`)
            const deps = options.package ? "&deps=" + encodeURIComponent(options.package) : "";
            const url = getRunUrl(options) + "#nofooter=1" + deps;
            const data = encodeURIComponent($c.text().trim());
            $sim.find("iframe").attr("src", url);
            $sim.find("iframe").attr("data-code", data);
            if (options.snippetReplaceParent) $c = $c.parent();
            $c.replaceWith($sim);
        });
    }

    export function renderAsync(options?: ClientRenderOptions): Promise<void> {
        pxt.analytics.enable();
        if (!options) options = defaultClientRenderOptions();
        if (options.pxtUrl) options.pxtUrl = options.pxtUrl.replace(/\/$/, '');
        if (options.showEdit) options.showEdit = !pxt.BrowserUtils.isIFrame();

        mergeConfig(options);

        renderQueue = [];
        renderGhost(options);
        renderSims(options);
        renderTypeScript(options);
        renderDirectPython(options);
        return Promise.resolve()
            .then(() => renderNextCodeCardAsync(options.codeCardClass, options))
            .then(() => renderNamespaces(options))
            .then(() => renderInlineBlocksAsync(options))
            .then(() => renderLinksAsync(options, options.linksClass, options.snippetReplaceParent, false))
            .then(() => renderLinksAsync(options, options.namespacesClass, options.snippetReplaceParent, true))
            .then(() => renderApisAsync(options, options.snippetReplaceParent))
            .then(() => renderSignaturesAsync(options))
            .then(() => renderSnippetsAsync(options))
            .then(() => renderBlocksAsync(options))
            .then(() => renderBlocksXmlAsync(options))
            .then(() => renderDiffBlocksXmlAsync(options))
            .then(() => renderDiffBlocksAsync(options))
            .then(() => renderDiffAsync(options))
            .then(() => renderStaticPythonAsync(options))
            .then(() => renderProjectAsync(options))
            .then(() => consumeRenderQueueAsync())
    }
}