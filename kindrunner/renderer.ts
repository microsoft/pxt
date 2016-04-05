namespace ks.runner {

    export interface ClientRenderOptions {
        snippetClass?: string;
        signatureClass?: string;
        blocksClass?: string;
        simulatorClass?: string;
        linksClass?: string;
        codeCardClass?: string;
        snippetReplaceParent?: boolean;
        simulator?: boolean;
        hex?: boolean;
        hexName?: string;
    }

    let runUrl = '/--run';
    function fillWithWidget($container: JQuery, $js: JQuery, $svg: JQuery, run?: boolean, hexname?: string, hex?: string) {
        if (!$svg || !$svg[0]) {
            let $c = $('<div class="ui segment"></div>');
            $c.append($js);
            $container.replaceWith($c);
            return;
        }

        let cdn = (window as any).appCdnRoot
        let images = cdn + "images"
        let $h = $('<div class="ui bottom attached tabular icon small compact menu">'
            + ' <div class="right icon menu"></div></div>');
        let $c = $('<div class="ui top attached segment"></div>');
        let $menu = $h.find('.right.menu');

        // blocks menu
        if ($svg && $svg[0]) {
            $c.append($svg);
            let $blockBtn = $('<a class="active item"><i aria-label="Blocks" class="puzzle icon"></i></a>').click(() => {
                $h.find('.active').removeClass('active')
                $blockBtn.addClass('active')
                $c.empty().append($svg);
            })
            $menu.append($blockBtn);
        }

        // js menu
        {
            let $jsBtn = $('<a class="item"><i aria-label="JavaScript" class="keyboard icon"></i></a>').click(() => {
                $h.find('.active').removeClass('active')
                $jsBtn.addClass('active')
                $c.empty().append($js);
            })
            $menu.append($jsBtn);
        }

        // runner menu
        if (run) {
            let $runBtn = $('<a class="item"><i aria-label="run" class="play icon"></i></a>').click(() => {
                $h.find('.active').removeClass('active')
                $runBtn.addClass('active')

                let $embed = $(`<div style="position:relative;height:0;padding-bottom:83%;overflow:hidden;"><iframe style="position:absolute;top:0;left:0;width:100%;height:100%;" src="${runUrl + "?code=" + encodeURIComponent($js.text())}" allowfullscreen="allowfullscreen" frameborder="0"></iframe></div>`);
                $c.empty().append($embed);
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

    function renderNextSnippetAsync(cls: string, render: (container: JQuery, r: ks.runner.DecompileResult) => void): Promise<void> {
        if (!cls) return Promise.resolve();

        let $el = $("." + cls).first();
        if (!$el[0]) return Promise.resolve();

        $el.removeClass(cls);
        return ks.runner.decompileToBlocksAsync($el.text())
            .then((r) => {
                try {
                    render($el, r);
                } catch (e) {
                    console.error('error while rendering ' + $el.html())
                    $el.append($('<div/>').addClass("ui segment warning").text(e.message));
                }
                return Promise.delay(1, renderNextSnippetAsync(cls, render));
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

    function decompileCallInfo(stmt: ts.Statement): ts.ks.CallInfo {
        if (!stmt || stmt.kind != ts.SyntaxKind.ExpressionStatement)
            return null;

        let estmt = stmt as ts.ExpressionStatement;
        if (!estmt.expression || estmt.expression.kind != ts.SyntaxKind.CallExpression)
            return null;

        let call = estmt.expression as ts.CallExpression;
        let info = (<any>call).callInfo as ts.ks.CallInfo;

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

    function renderBlocksAsync(options: ClientRenderOptions): Promise<void> {
        return renderNextSnippetAsync(options.blocksClass, (c, r) => {
            let s = r.blocksSvg;
            if (options.snippetReplaceParent) c = c.parent();
            c.replaceWith(s);
        });
    }

    function renderLinksAsync(options: ClientRenderOptions): Promise<void> {
        return renderNextSnippetAsync(options.linksClass, (c, r) => {
            let cjs = r.compileJS;
            if (!cjs) return;
            let file = r.compileJS.ast.getSourceFile("main.ts");
            let stmts = file.statements;
            let ul = $('<div />').addClass('ui cards');

            let addItem = (card : ks.CodeCard) => {
                if (!card) return;

                ul.append(ks.docs.codeCard.render(card));
            }

            stmts.forEach(stmt => {
                let info = decompileCallInfo(stmt);
                if (info) {
                    let block = Blockly.Blocks[info.attrs.blockId];
                    if (block) {
                        addItem(block.codeCard);
                    }
                }
                    
                
                // TODO support statements
            })

            if (options.snippetReplaceParent) c = c.parent();
            c.replaceWith(ul)
        })
    }

    function fillCodeCardAsync(c: JQuery, card: ks.CodeCard): Promise<void> {
        if (!card) return Promise.resolve();

        let cc = ks.docs.codeCard.render(card)
        c.replaceWith(cc);

        return Promise.resolve();
    }

    function renderNextCodeCardAsync(cls: string): Promise<void> {
        if (!cls) return Promise.resolve();

        let $el = $("." + cls).first();
        if (!$el[0]) return Promise.resolve();

        $el.removeClass(cls);
        let card: ks.CodeCard;
        try {
            card = JSON.parse($el.text()) as ks.CodeCard;
        } catch (e) {
            console.error('error while rendering ' + $el.html())
            $el.append($('<div/>').addClass("ui segment warning").text(e.messageText));
        }

        return fillCodeCardAsync($el, card)
            .then(() => Promise.delay(1, renderNextCodeCardAsync(cls)));
    }

    export function renderAsync(options?: ClientRenderOptions): Promise<void> {
        if (!options) options = {}

        if (options.simulatorClass) {
            // simulators
            $('.' + options.simulatorClass).each((i, c) => {
                let $c = $(c);
                let $sim = $(`<div class="ui container"><div class="ui centered card">
                    <div style="position:relative;height:0;padding-bottom:83%;overflow:hidden;">
                    <iframe style="position:absolute;top:0;left:0;width:100%;height:100%;" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
                    </div>
                    </div></div>`)
                $sim.find("iframe").attr("src", runUrl + "?code=" + encodeURIComponent($c.text().trim()));
                $c.replaceWith($sim);
            });
        }

        return renderNextCodeCardAsync(options.codeCardClass)
            .then(() => renderSignaturesAsync(options))
            .then(() => renderSnippetsAsync(options))
            .then(() => renderBlocksAsync(options))
            .then(() => renderLinksAsync(options))
    }
}