namespace pxt.runner {

    export interface ClientRenderOptions {
        snippetClass?: string;
        signatureClass?: string;
        blocksClass?: string;
        shuffleClass?: string;
        simulatorClass?: string;
        linksClass?: string;
        namespacesClass?: string;
        codeCardClass?: string;
        snippetReplaceParent?: boolean;
        simulator?: boolean;
        hex?: boolean;
        hexName?: string;
    }

    function fillWithWidget($container: JQuery, $js: JQuery, $svg: JQuery, run?: boolean, hexname?: string, hex?: string) {
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
        {
            let $jsBtn = $('<a class="item js"><i aria-label="JavaScript" class="keyboard icon"></i></a>').click(() => {
                if ($c.find('.js')[0])
                    $c.find('.js').remove(); // remove previous simulators
                else {
                    let $jsc = $('<div class="ui content js"/>').append($js);
                    if ($svg) $jsc.insertAfter($svg);
                    else $c.append($jsc);
                }
            })
            $menu.append($jsBtn);
        }

        // runner menu
        if (run) {
            let $runBtn = $('<a class="item"><i aria-label="run" class="play icon"></i></a>').click(() => {
                if ($c.find('.sim')[0])
                    $c.find('.sim').remove(); // remove previous simulators
                else {
                    let padding = '81.97%';
                    if (pxt.appTarget.simulator) padding = (100 / pxt.appTarget.simulator.aspectRatio) + '%';
                    let $embed = $(`<div class="ui card sim"><div class="ui content"><div style="position:relative;height:0;padding-bottom:${padding};overflow:hidden;"><iframe style="position:absolute;top:0;left:0;width:100%;height:100%;" src="${getRunUrl() + "?nofooter=1&code=" + encodeURIComponent($js.text())}" allowfullscreen="allowfullscreen" frameborder="0"></iframe></div></div></div>`);
                    $c.append($embed);
                }
            })
            $menu.append($runBtn);
        }

        if (hexname && hex) {
            let $hexBtn = $('<a class="item"><i aria-label="download" class="download icon"></i></a>').click(() => {
                BrowserUtils.browserDownloadText(hex, hexname, "application/x-microbit-hex");
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
            let hex = options.hex && compiled && r.compileJS.outfiles["microbit.hex"]
                ? r.compileJS.outfiles["microbit.hex"] : undefined;
            let hexname = `${appTarget.id}-${options.hexName || ''}-${snippetCount++}.hex`;
            fillWithWidget(c, js, s,
                options.simulator && compiled,
                hexname,
                hex);
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
            let js = $('<code/>').text(sig)
            if (options.snippetReplaceParent) c = c.parent();
            fillWithWidget(c, js, s, false);
        });
    }

    function renderShuffleAsync(options: ClientRenderOptions): Promise<void> {
        return renderNextSnippetAsync(options.shuffleClass, (c, r) => {
            let s = r.blocksSvg;
            if (options.snippetReplaceParent) c = c.parent();
            let segment = $('<div class="ui segment"/>').append(s);
            c.replaceWith(segment);
        }, { emPixels: 14, layout: pxt.blocks.BlockLayout.Shuffle });
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
                                    ? `<xml><block type="${info.attrs.blockId}"></block></xml>`
                                    : undefined,
                            link: true
                        })
                    } else if (block) {
                        let card = U.clone(block.codeCard);
                        if (card) {
                            card.link = true;
                            addItem(card);
                        }
                    }
                }
                switch (stmt.kind) {
                    case ts.SyntaxKind.IfStatement:
                        addItem({
                            name: ns ? "Logic" : "if",
                            url: "reference/logic" + (ns ? "" : "/if"),
                            description: ns ? lf("Logic operators and constants") : lf("Conditional statement"),
                            blocksXml: '<xml><block type="controls_if"></block></xml>',
                            link: true
                        });
                        break;
                    case ts.SyntaxKind.ForStatement:
                        addItem({
                            name: ns ? "Loops" : "for",
                            url: "reference/loops" + (ns ? "" : "/for"),
                            description: ns ? lf("Loops and repetition") : lf("Repeat code for a given number of times."),
                            blocksXml: '<xml><block type="controls_simple_for"></block></xml>',
                            link: true
                        });
                        break;
                    case ts.SyntaxKind.VariableStatement:
                        addItem({
                            name: ns ? "Variables" : "variable declaration",
                            url: "reference/variables" + (ns ? "" : "/assign"),
                            description: ns ? lf("Variables") : lf("Assign a value to a named variable."),
                            blocksXml: '<xml><block type="variables_set"></block></xml>',
                            link: true
                        });
                        break;
                }
            })

            if (replaceParent) c = c.parent();
            c.replaceWith(ul)
        })
    }

    function fillCodeCardAsync(c: JQuery, card: pxt.CodeCard, options: pxt.docs.codeCard.CodeCardRenderOptions): Promise<void> {
        if (!card) return Promise.resolve();

        let cc = pxt.docs.codeCard.render(card, options)
        c.replaceWith(cc);

        return Promise.resolve();
    }

    function renderNextCodeCardAsync(cls: string): Promise<void> {
        if (!cls) return Promise.resolve();

        let $el = $("." + cls).first();
        if (!$el[0]) return Promise.resolve();

        $el.removeClass(cls);
        let card: pxt.CodeCard;
        try {
            card = JSON.parse($el.text()) as pxt.CodeCard;
        } catch (e) {
            console.error('error while rendering ' + $el.html())
            $el.append($('<div/>').addClass("ui segment warning").text(e.messageText));
        }

        return fillCodeCardAsync($el, card, { hideHeader: true })
            .then(() => Promise.delay(1, renderNextCodeCardAsync(cls)));
    }

    function getRunUrl() {
        return pxt.webConfig && pxt.webConfig.runUrl ? pxt.webConfig.runUrl : '/--run';
    }

    export function renderAsync(options?: ClientRenderOptions): Promise<void> {
        if (!options) options = {}

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
                $sim.find("iframe").attr("src", getRunUrl() + "?nofooter=1&code=" + encodeURIComponent($c.text().trim()));
                if (options.snippetReplaceParent) $c = $c.parent();
                $c.replaceWith($sim);
            });
        }

        return Promise.resolve()
            .then(() => renderShuffleAsync(options))
            .then(() => renderLinksAsync(options.linksClass, options.snippetReplaceParent, false))
            .then(() => renderLinksAsync(options.namespacesClass, options.snippetReplaceParent, true))
            .then(() => renderSignaturesAsync(options))
            .then(() => renderNextCodeCardAsync(options.codeCardClass))
            .then(() => renderSnippetsAsync(options))
            .then(() => renderBlocksAsync(options));
    }
}