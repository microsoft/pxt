/// <reference path="../typings/ace/ace.d.ts" />

namespace pxt.runner {

    export interface ClientRenderOptions {
        snippetClass?: string;
        signatureClass?: string;
        blocksClass?: string;
        shuffleClass?: string;
        blocksAspectRatio?: number;
        simulatorClass?: string;
        linksClass?: string;
        namespacesClass?: string;
        codeCardClass?: string;
        snippetReplaceParent?: boolean;
        simulator?: boolean;
        hex?: boolean;
        hexName?: string;
        pxtUrl?: string;
    }

    export interface WidgetOptions {
        showJs?: boolean;
        hideGutter?: boolean;
        run?: boolean;
        hexname?: string;
        hex?: string;
    }

    function appendJs($parent: JQuery, $js: JQuery, woptions: WidgetOptions) {
        if (typeof ace !== "undefined") {
            const src = $js.text() || '';
            let $c = $('<div class="ui content js"></div>').text(src);
            let editor = ace.edit($c[0]);
            editor.setTheme("ace/theme/textmate");
            editor.getSession().setMode("ace/mode/typescript");
            editor.setReadOnly(true);
            editor.setShowPrintMargin(false);
            editor.renderer.setShowGutter(!woptions.hideGutter && src.split('\n').length > 5);
            editor.setHighlightActiveLine(false);
            editor.clearSelection();
            editor.$blockScrolling = Infinity;
            (editor.renderer as any).$cursorLayer.element.style.display = "none"
            editor.setOptions({
                maxLines: 1024
            });
            $parent.append($c);
            editor.resize(true);
        } else
            $parent.append($('<div class="ui content js"/>').append($js));
    }

    function fillWithWidget(
        options: ClientRenderOptions,
        $container: JQuery,
        $js: JQuery,
        $svg: JQuery,
        woptions: WidgetOptions = {}
    ) {
        if (!$svg || !$svg[0]) {
            let $c = $('<div class="ui segment"></div>');
            $c.append($js);
            $container.replaceWith($c);
            return;
        }

        let cdn = pxt.webConfig.pxtCdnUrl
        let images = cdn + "images"
        let $h = $('<div class="ui bottom attached tabular icon small compact menu">'
            + ' <div class="right icon menu"></div></div>');
        let $c = $('<div class="ui top attached segment"></div>');
        let $menu = $h.find('.right.menu');

        // blocks
        $c.append($svg);

        // js menu
        if (woptions.showJs) {
            appendJs($c, $js, woptions);
        } else {
            let $jsBtn = $('<a class="item js"><i aria-label="JavaScript" class="keyboard icon"></i></a>').click(() => {
                if ($c.find('.js')[0])
                    $c.find('.js').remove(); // remove previous simulators
                else {
                    if ($svg) appendJs($svg.parent(), $js, woptions);
                    else appendJs($c, $js, woptions);
                }
            })
            $menu.append($jsBtn);
        }

        // runner menu
        if (woptions.run) {
            let $runBtn = $('<a class="item"><i aria-label="run" class="play icon"></i></a>').click(() => {
                if ($c.find('.sim')[0])
                    $c.find('.sim').remove(); // remove previous simulators
                else {
                    let padding = '81.97%';
                    if (pxt.appTarget.simulator) padding = (100 / pxt.appTarget.simulator.aspectRatio) + '%';
                    let $embed = $(`<div class="ui card sim"><div class="ui content"><div style="position:relative;height:0;padding-bottom:${padding};overflow:hidden;"><iframe style="position:absolute;top:0;left:0;width:100%;height:100%;" src="${getRunUrl(options) + "?nofooter=1&code=" + encodeURIComponent($js.text())}" allowfullscreen="allowfullscreen" frameborder="0"></iframe></div></div></div>`);
                    $c.append($embed);
                }
            })
            $menu.append($runBtn);
        }

        if (woptions.hexname && woptions.hex) {
            let $hexBtn = $('<a class="item"><i aria-label="download" class="download icon"></i></a>').click(() => {
                BrowserUtils.browserDownloadText(woptions.hex, woptions.hexname, pxt.appTarget.compile.hexMimeType);
            })
            $menu.append($hexBtn);
        }

        // inject container
        $container.replaceWith([$c, $h]);
    }

    function renderNextSnippetAsync(cls: string, render: (container: JQuery, r: pxt.runner.DecompileResult) => void, options?: pxt.blocks.BlocksRenderOptions): Promise<void> {
        if (!cls) return Promise.resolve();

        let $el = $("." + cls).first();
        if (!$el[0]) return Promise.resolve();

        return pxt.runner.decompileToBlocksAsync($el.text(), options)
            .then((r) => {
                try {
                    render($el, r);
                } catch (e) {
                    console.error('error while rendering ' + $el.html())
                    $el.append($('<div/>').addClass("ui segment warning").text(e.message));
                }
                $el.removeClass(cls);
                return Promise.delay(1, renderNextSnippetAsync(cls, render, options));
            })
    }

    function renderSnippetsAsync(options: ClientRenderOptions): Promise<void> {
        let snippetCount = 0;
        return renderNextSnippetAsync(options.snippetClass, (c, r) => {
            let s = r.compileBlocks && r.compileBlocks.success ? r.blocksSvg : undefined;
            let js = $('<code/>').text(c.text().trim());
            if (options.snippetReplaceParent) c = c.parent();
            let compiled = r.compileJS && r.compileJS.success;
            let hex = options.hex && compiled && r.compileJS.outfiles[ts.pxt.BINARY_HEX]
                ? r.compileJS.outfiles[ts.pxt.BINARY_HEX] : undefined;
            let hexname = `${appTarget.id}-${options.hexName || ''}-${snippetCount++}.hex`;
            fillWithWidget(options, c, js, s, {
                run: options.simulator && compiled,
                hexname: hexname,
                hex: hex,
            });
        });
    }

    function decompileCallInfo(stmt: ts.Statement): ts.pxt.CallInfo {
        if (!stmt || stmt.kind != ts.SyntaxKind.ExpressionStatement)
            return null;

        let estmt = stmt as ts.ExpressionStatement;
        if (!estmt.expression || estmt.expression.kind != ts.SyntaxKind.CallExpression)
            return null;

        let call = estmt.expression as ts.CallExpression;
        let info = (<any>call).callInfo as ts.pxt.CallInfo;

        return info;
    }

    function renderSignaturesAsync(options: ClientRenderOptions): Promise<void> {
        return renderNextSnippetAsync(options.signatureClass, (c, r) => {
            let cjs = r.compileJS;
            if (!cjs) return;
            let file = r.compileJS.ast.getSourceFile("main.ts");
            let info = decompileCallInfo(file.statements[0]);
            if (!info) return;

            let s = r.compileBlocks && r.compileBlocks.success ? r.blocksSvg : undefined;
            let sig = info.decl.getText().replace(/^export/, '');
            sig = sig.slice(0, sig.indexOf('{')).trim() + ';';
            let js = $('<code/>').text(sig);
            if (options.snippetReplaceParent) c = c.parent();
            fillWithWidget(options, c, js, s, { showJs: true, hideGutter: true });
        });
    }

    function renderShuffleAsync(options: ClientRenderOptions): Promise<void> {
        return renderNextSnippetAsync(options.shuffleClass, (c, r) => {
            let s = r.blocksSvg;
            if (options.snippetReplaceParent) c = c.parent();
            let segment = $('<div class="ui segment"/>').append(s);
            c.replaceWith(segment);
        }, { emPixels: 14, layout: pxt.blocks.BlockLayout.Shuffle, aspectRatio: options.blocksAspectRatio });
    }

    function renderBlocksAsync(options: ClientRenderOptions): Promise<void> {
        return renderNextSnippetAsync(options.blocksClass, (c, r) => {
            let s = r.blocksSvg;
            if (options.snippetReplaceParent) c = c.parent();
            c.replaceWith(s);
        });
    }

    function renderLinksAsync(cls: string, replaceParent: boolean, ns: boolean): Promise<void> {
        return renderNextSnippetAsync(cls, (c, r) => {
            let cjs = r.compileJS;
            if (!cjs) return;
            let file = r.compileJS.ast.getSourceFile("main.ts");
            let stmts = file.statements;
            let ul = $('<div />').addClass('ui cards');

            let addItem = (card: pxt.CodeCard) => {
                if (!card) return;
                ul.append(pxt.docs.codeCard.render(card, { hideHeader: true }));
            }

            stmts.forEach(stmt => {
                let info = decompileCallInfo(stmt);
                if (info) {
                    let block = Blockly.Blocks[info.attrs.blockId];
                    if (ns) {
                        let ii = r.compileBlocks.blocksInfo.apis.byQName[info.qName];
                        let nsi = r.compileBlocks.blocksInfo.apis.byQName[ii.namespace];
                        addItem({
                            name: nsi.name,
                            url: nsi.attributes.help || ("reference/" + nsi.name),
                            description: nsi.attributes.jsDoc,
                            blocksXml: block && block.codeCard
                                ? block.codeCard.blocksXml
                                : info.attrs.blockId
                                    ? `<xml xmlns="http://www.w3.org/1999/xhtml"><block type="${info.attrs.blockId}"></block></xml>`
                                    : undefined
                        })
                    } else if (block) {
                        let card = U.clone(block.codeCard);
                        if (card) {
                            card.link = true;
                            addItem(card);
                        }
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
                                    console.log(`card expr kind: ${es.expression.kind}`);
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
                        case ts.SyntaxKind.ForStatement:
                            addItem({
                                name: ns ? "Loops" : "for",
                                url: "blocks/loops" + (ns ? "" : "/for"),
                                description: ns ? lf("Loops and repetition") : lf("Repeat code for a given number of times."),
                                blocksXml: '<xml xmlns="http://www.w3.org/1999/xhtml"><block type="controls_simple_for"></block></xml>'
                            });
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
                            console.log(`card kind: ${stmt.kind}`)
                    }
            })

            if (replaceParent) c = c.parent();
            c.replaceWith(ul)
        })
    }

    function fillCodeCardAsync(c: JQuery, cards: pxt.CodeCard[], options: pxt.docs.codeCard.CodeCardRenderOptions): Promise<void> {
        if (!cards || cards.length == 0) return Promise.resolve();

        if (cards.length == 0) {
            let cc = pxt.docs.codeCard.render(cards[0], options)
            c.replaceWith(cc);
        } else {
            let cd = document.createElement("div")
            cd.className = "ui cards";
            cards.forEach(card => cd.appendChild(pxt.docs.codeCard.render(card, options)));
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
            console.error('error while rendering ' + $el.html())
            $el.append($('<div/>').addClass("ui segment warning").text(e.messageText));
        }

        if (options.snippetReplaceParent) $el = $el.parent();
        return fillCodeCardAsync($el, cards, { hideHeader: true })
            .then(() => Promise.delay(1, renderNextCodeCardAsync(cls, options)));
    }

    function getRunUrl(options: ClientRenderOptions) {
        return options.pxtUrl ? options.pxtUrl + '/--run' : pxt.webConfig && pxt.webConfig.runUrl ? pxt.webConfig.runUrl : '/--run';
    }

    export function renderAsync(options?: ClientRenderOptions): Promise<void> {
        if (!options) options = {}

        if (options.pxtUrl) options.pxtUrl = options.pxtUrl.replace(/\/$/, '');

        if (options.simulatorClass) {
            // simulators
            $('.' + options.simulatorClass).each((i, c) => {
                let $c = $(c);
                let padding = '81.97%';
                if (pxt.appTarget.simulator) padding = (100 / pxt.appTarget.simulator.aspectRatio) + '%';
                let $sim = $(`<div class="ui centered card"><div class="ui content">
                    <div style="position:relative;height:0;padding-bottom:${padding};overflow:hidden;">
                    <iframe style="position:absolute;top:0;left:0;width:100%;height:100%;" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
                    </div>
                    </div></div>`)
                $sim.find("iframe").attr("src", getRunUrl(options) + "?nofooter=1&code=" + encodeURIComponent($c.text().trim()));
                if (options.snippetReplaceParent) $c = $c.parent();
                $c.replaceWith($sim);
            });
        }

        return Promise.resolve()
            .then(() => renderShuffleAsync(options))
            .then(() => renderLinksAsync(options.linksClass, options.snippetReplaceParent, false))
            .then(() => renderLinksAsync(options.namespacesClass, options.snippetReplaceParent, true))
            .then(() => renderSignaturesAsync(options))
            .then(() => renderNextCodeCardAsync(options.codeCardClass, options))
            .then(() => renderSnippetsAsync(options))
            .then(() => renderBlocksAsync(options));
    }
}