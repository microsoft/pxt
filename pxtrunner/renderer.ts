/* tslint:disable:no-jquery-raw-elements TODO(tslint): get rid of jquery html() calls */

namespace pxt.runner {
    const JS_ICON = "icon xicon js";
    const PY_ICON = "icon xicon python";
    const BLOCKS_ICON = "icon xicon blocks"

    export interface ClientRenderOptions {
        snippetClass?: string;
        signatureClass?: string;
        blocksClass?: string;
        blocksXmlClass?: string;
        staticPythonClass?: string; // typescript to be converted to static python
        projectClass?: string;
        blocksAspectRatio?: number;
        simulatorClass?: string;
        linksClass?: string;
        namespacesClass?: string;
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

    export interface WidgetOptions {
        showEdit?: boolean;
        showJs?: boolean;
        showPy?: boolean;
        hideGutter?: boolean;
        run?: boolean;
        hexname?: string;
        hex?: string;
    }

    function appendBlocks($parent: JQuery, $svg: JQuery) {
        $parent.append($('<div class="ui content blocks"/>').append($svg));
    }

    function highlight($js: JQuery) {
        if (typeof hljs !== "undefined") {
            if ($js.hasClass("highlight"))
                hljs.highlightBlock($js[0]);
            else $js.find('code.highlight').each(function (i, block) {
                hljs.highlightBlock(block);
            });
        }
    }

    function appendJs($parent: JQuery, $js: JQuery, woptions: WidgetOptions) {
        $parent.append($('<div class="ui content js"><div><i class="ui icon xicon js"/>JavaScript</div></div>').append($js));
        highlight($js);
    }

    function appendPy($parent: JQuery, $py: JQuery, woptions: WidgetOptions) {
        $parent.append($('<div class="ui content py"><div><i class="ui icon xicon python"/>Python</div></div>').append($py));
        highlight($py);
    }

    function snippetBtn(label: string, icon: string): JQuery {
        const $btn = $(`<a class="item" role="button" tabindex="0"><i role="presentation" aria-hidden="true"></i><span class="ui desktop only"></span></a>`);
        $btn.attr("aria-label", label);
        $btn.attr("title", label);
        $btn.find('i').attr("class", icon);
        $btn.find('span').text(label);
        return $btn;
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
            const $editBtn = snippetBtn(lf("Edit"), "edit icon").click(() => {
                pxt.tickEvent("docs.btn", { button: "edit" });
                decompileResult.package.setPreferredEditor(options.showJavaScript ? pxt.JAVASCRIPT_PROJECT_NAME : pxt.BLOCKS_PROJECT_NAME)
                decompileResult.package.compressToFileAsync()
                    .done(buf => window.open(`${getEditUrl(options)}/#project:${ts.pxtc.encodeBase64(Util.uint8ArrayToString(buf))}`, 'pxt'))
            })
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
                if ($c.find('.sim')[0])
                    $c.find('.sim').remove(); // remove previous simulators
                else {
                    let padding = '81.97%';
                    if (pxt.appTarget.simulator) padding = (100 / pxt.appTarget.simulator.aspectRatio) + '%';
                    let $embed = $(`<div class="ui card sim"><div class="ui content"><div style="position:relative;height:0;padding-bottom:${padding};overflow:hidden;"><iframe style="position:absolute;top:0;left:0;width:100%;height:100%;" src="${getRunUrl(options) + "#nofooter=1&code=" + encodeURIComponent($js.text())}" allowfullscreen="allowfullscreen" sandbox="allow-popups allow-forms allow-scripts allow-same-origin" frameborder="0"></iframe></div></div></div>`);
                    $c.append($embed);
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

        let r = [$c];
        // don't add menu if empty
        if ($menu.children().length) r.push($h);

        // inject container
        $container.replaceWith(r as any);

        function appendBlocksButton() {
            if (!$svg) return;
            const $svgBtn = snippetBtn(lf("Blocks"), BLOCKS_ICON).click(() => {
                pxt.tickEvent("docs.btn", { button: "blocks" });
                if ($c.find('.blocks')[0])
                    $c.find('.blocks').remove();
                else {
                    if ($js) appendBlocks($js.parent(), $svg);
                    else appendBlocks($c, $svg);
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
                    if ($c.find('.js')[0])
                        $c.find('.js').remove();
                    else {
                        if ($svg) appendJs($svg.parent(), $js, woptions);
                        else appendJs($c, $js, woptions);
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
                    if ($c.find('.py')[0])
                        $c.find('.py').remove();
                    else {
                        if ($svg) appendPy($svg.parent(), $py, woptions);
                        else appendPy($c, $py, woptions);
                    }
                })
                $menu.append($pyBtn);
            }
        }
    }

    let renderQueue: {
        el: JQuery;
        source: string;
        options: blocks.BlocksRenderOptions;
        render: (container: JQuery, r: pxt.runner.DecompileResult) => void;
    }[] = [];
    function consumeRenderQueueAsync(): Promise<void> {
        const job = renderQueue.shift();
        if (!job) return Promise.resolve(); // done

        const { el, options, render } = job;
        return pxt.runner.decompileToBlocksAsync(el.text(), options)
            .then((r) => {
                const errors = r.compileJS && r.compileJS.diagnostics && r.compileJS.diagnostics.filter(d => d.category == pxtc.DiagnosticCategory.Error);
                if (errors && errors.length)
                    errors.forEach(diag => pxt.reportError("docs.decompile", "" + diag.messageText, { "code": diag.code + "" }));
                render(el, r);
                el.removeClass("lang-shadow");
                return consumeRenderQueueAsync();
            }).catch(e => {
                pxt.reportException(e);
                el.append($('<div/>').addClass("ui segment warning").text(e.message));
                el.removeClass("lang-shadow");
                return consumeRenderQueueAsync();
            });
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
            const s = r.compileBlocks && r.compileBlocks.success ? $(r.blocksSvg) : undefined;
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
        let info = (<any>call).callInfo as pxtc.CallInfo;

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
            let xml = block && block.codeCard ? block.codeCard.blocksXml : undefined;

            const s = xml ? $(pxt.blocks.render(xml)) : r.compileBlocks && r.compileBlocks.success ? $(r.blocksSvg) : undefined;
            let sig = info.decl.getText().replace(/^export/, '');
            sig = sig.slice(0, sig.indexOf('{')).trim() + ';';
            const js = $('<code class="lang-typescript highlight"/>').text(sig);
            // TODO python
            const py: JQuery = undefined;// $('<code class="lang-python highlight"/>').text(sig);
            if (options.snippetReplaceParent) c = c.parent();
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
        const woptions: WidgetOptions = {
            showEdit: !!options.showEdit,
            run: !!options.simulator
        }
        return renderNextSnippetAsync(options.staticPythonClass, (c, r) => {
            const s = r.compilePython;
            if (s && s.success) {
                const $js = c.clone().removeClass('lang-shadow').addClass('lang-typescript');
                const $py = c.clone().removeClass('lang-shadow').addClass('lang-python').text(s.outfiles["main.py"]);
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

    function renderNamespaces(options: ClientRenderOptions): Promise<void> {
        if (pxt.appTarget.id == "core") return Promise.resolve();

        return pxt.runner.decompileToBlocksAsync('', options)
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
            return pxt.runner.decompileToBlocksAsync(code, options)
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

    function renderLinksAsync(options: ClientRenderOptions, cls: string, replaceParent: boolean, ns: boolean): Promise<void> {
        return renderNextSnippetAsync(cls, (c, r) => {
            const cjs = r.compileProgram;
            if (!cjs) return;
            const file = cjs.getSourceFile("main.ts");
            const stmts = file.statements.slice(0);
            const ul = $('<div />').addClass('ui cards');
            ul.attr("role", "listbox");
            const addItem = (card: pxt.CodeCard) => {
                if (!card) return;
                const mC = /^\/(v\d+)/.exec(card.url);
                const mP = /^\/(v\d+)/.exec(window.location.pathname);
                const inEditor = /#doc/i.test(window.location.href);
                if (card.url && !mC && mP && !inEditor) card.url = `/${mP[1]}/${card.url}`;
                ul.append(pxt.docs.codeCard.render(card, { hideHeader: true, shortName: true }));
            }
            stmts.forEach(stmt => {
                let info = decompileCallInfo(stmt);
                if (info && r.apiInfo && r.apiInfo.byQName[info.qName]) {
                    const attributes = r.apiInfo.byQName[info.qName].attributes;
                    let block = Blockly.Blocks[attributes.blockId];
                    if (ns) {
                        let ii = r.compileBlocks.blocksInfo.apis.byQName[info.qName];
                        let nsi = r.compileBlocks.blocksInfo.apis.byQName[ii.namespace];
                        addItem({
                            name: nsi.attributes.blockNamespace || nsi.name,
                            url: nsi.attributes.help || ("reference/" + (nsi.attributes.blockNamespace || nsi.name).toLowerCase()),
                            description: nsi.attributes.jsDoc,
                            blocksXml: block && block.codeCard
                                ? block.codeCard.blocksXml
                                : attributes.blockId
                                    ? `<xml xmlns="http://www.w3.org/1999/xhtml"><block type="${attributes.blockId}"></block></xml>`
                                    : undefined
                        })
                    } else if (block) {
                        let card = U.clone(block.codeCard) as pxt.CodeCard;
                        if (card) {
                            addItem(card);
                        }
                    } else {
                        // no block available here
                        addItem({
                            name: info.qName,
                            description: attributes.jsDoc,
                            url: attributes.help || undefined
                        })
                    }
                } else
                    switch (stmt.kind) {
                        case ts.SyntaxKind.ExpressionStatement:
                            let es = stmt as ts.ExpressionStatement;
                            switch (es.expression.kind) {
                                case ts.SyntaxKind.TrueKeyword:
                                case ts.SyntaxKind.FalseKeyword:
                                    addItem({
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
                        case ts.SyntaxKind.IfStatement:
                            addItem({
                                name: ns ? "Logic" : "if",
                                url: "blocks/logic" + (ns ? "" : "/if"),
                                description: ns ? lf("Logic operators and constants") : lf("Conditional statement"),
                                blocksXml: '<xml xmlns="http://www.w3.org/1999/xhtml"><block type="controls_if"></block></xml>'
                            });
                            break;
                        case ts.SyntaxKind.WhileStatement:
                            addItem({
                                name: ns ? "Loops" : "while",
                                url: "blocks/loops" + (ns ? "" : "/while"),
                                description: ns ? lf("Loops and repetition") : lf("Repeat code while a condition is true."),
                                blocksXml: '<xml xmlns="http://www.w3.org/1999/xhtml"><block type="device_while"></block></xml>'
                            });
                            break;
                        case ts.SyntaxKind.ForOfStatement:
                            addItem({
                                name: ns ? "Loops" : "for of",
                                url: "blocks/loops" + (ns ? "" : "/for-of"),
                                description: ns ? lf("Loops and repetition") : lf("Repeat code for each item in a list."),
                                blocksXml: '<xml xmlns="http://www.w3.org/1999/xhtml"><block type="controls_for_of"></block></xml>'
                            });
                            break;
                        case ts.SyntaxKind.ForStatement:
                            let fs = stmt as ts.ForStatement;
                            // look for the 'repeat' loop style signature in the condition expression, explicitly: (let i = 0; i < X; i++)
                            // for loops will have the '<=' conditional.
                            let forloop = true;
                            if (fs.condition.getChildCount() == 3) {
                                forloop = !(fs.condition.getChildAt(0).getText() == "0" ||
                                    fs.condition.getChildAt(1).kind == ts.SyntaxKind.LessThanToken);
                            }
                            if (forloop) {
                                addItem({
                                    name: ns ? "Loops" : "for",
                                    url: "blocks/loops" + (ns ? "" : "/for"),
                                    description: ns ? lf("Loops and repetition") : lf("Repeat code for a given number of times using an index."),
                                    blocksXml: '<xml xmlns="http://www.w3.org/1999/xhtml"><block type="controls_simple_for"></block></xml>'
                                });
                            } else {
                                addItem({
                                    name: ns ? "Loops" : "repeat",
                                    url: "blocks/loops" + (ns ? "" : "/repeat"),
                                    description: ns ? lf("Loops and repetition") : lf("Repeat code for a given number of times."),
                                    blocksXml: '<xml xmlns="http://www.w3.org/1999/xhtml"><block type="controls_repeat_ext"></block></xml>'
                                });
                            }
                            break;
                        case ts.SyntaxKind.VariableStatement:
                            addItem({
                                name: ns ? "Variables" : "variable declaration",
                                url: "blocks/variables" + (ns ? "" : "/assign"),
                                description: ns ? lf("Variables") : lf("Assign a value to a named variable."),
                                blocksXml: '<xml xmlns="http://www.w3.org/1999/xhtml"><block type="variables_set"></block></xml>'
                            });
                            break;
                        default:
                            pxt.debug(`card kind: ${stmt.kind}`)
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

    function renderTypeScript(options?: ClientRenderOptions) {
        const woptions: WidgetOptions = {
            showEdit: !!options.showEdit,
            run: !!options.simulator
        }

        function render(e: Node, ignored: boolean) {
            if (typeof hljs !== "undefined") {
                $(e).text($(e).text().replace(/^\s*\r?\n/, ''))
                hljs.highlightBlock(e)
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

    export function renderAsync(options?: ClientRenderOptions): Promise<void> {
        pxt.analytics.enable();
        if (!options) options = {}
        if (options.pxtUrl) options.pxtUrl = options.pxtUrl.replace(/\/$/, '');
        if (options.showEdit) options.showEdit = !pxt.BrowserUtils.isIFrame();

        mergeConfig(options);
        if (options.simulatorClass) {
            // simulators
            $('.' + options.simulatorClass).each((i, c) => {
                let $c = $(c);
                let padding = '81.97%';
                if (pxt.appTarget.simulator) padding = (100 / pxt.appTarget.simulator.aspectRatio) + '%';
                let $sim = $(`<div class="ui centered card"><div class="ui content">
                    <div style="position:relative;height:0;padding-bottom:${padding};overflow:hidden;">
                    <iframe style="position:absolute;top:0;left:0;width:100%;height:100%;" allowfullscreen="allowfullscreen" frameborder="0" sandbox="allow-popups allow-forms allow-scripts allow-same-origin"></iframe>
                    </div>
                    </div></div>`)
                $sim.find("iframe").attr("src", getRunUrl(options) + "#nofooter=1&code=" + encodeURIComponent($c.text().trim()));
                if (options.snippetReplaceParent) $c = $c.parent();
                $c.replaceWith($sim);
            });
        }

        renderQueue = [];
        renderTypeScript(options);
        return Promise.resolve()
            .then(() => renderNextCodeCardAsync(options.codeCardClass, options))
            .then(() => renderNamespaces(options))
            .then(() => renderInlineBlocksAsync(options))
            .then(() => renderLinksAsync(options, options.linksClass, options.snippetReplaceParent, false))
            .then(() => renderLinksAsync(options, options.namespacesClass, options.snippetReplaceParent, true))
            .then(() => renderSignaturesAsync(options))
            .then(() => renderSnippetsAsync(options))
            .then(() => renderBlocksAsync(options))
            .then(() => renderBlocksXmlAsync(options))
            .then(() => renderStaticPythonAsync(options))
            .then(() => renderProjectAsync(options))
            .then(() => consumeRenderQueueAsync())
    }
}