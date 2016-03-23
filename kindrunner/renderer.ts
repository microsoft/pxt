namespace ks.runner {

    export interface ClientRenderOptions {
        snippetClass?: string;
        signatureClass?: string;
        blocksClass?: string;
        snippetReplaceParent?: boolean;
    }

    function fillWithWidget($container: JQuery, $js: JQuery, $svg: JQuery) {
        if (!$svg || !$svg[0]) {
            let $c = $('<div class="ui segment"></div>');
            $c.append($js);
            $container.replaceWith($c);
            return;
        }

        let $c = $('<div class="ui top attached segment"></div>');
        $c.append($svg);
        let $blockBtn = $('<a class="active item"><i class="puzzle icon"></i></a>').click(() => {
            $jsBtn.removeClass('active')
            $blockBtn.addClass('active')
            $c.empty().append($svg);
        })
        let $jsBtn = $('<a class="item"><i class="keyboard icon"></i></a>').click(() => {
            $jsBtn.addClass('active')
            $blockBtn.removeClass('active')
            $c.empty().append($js);
        })
        let $h = $('<div class="ui bottom attached tabular icon small compact menu">'
            + ' <div class="right icon menu"></div></div>');
        $h.find('.right.menu').append([$blockBtn, $jsBtn]);
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
                }
                return renderNextSnippetAsync(cls, render);
            })
    }

    export function renderAsync(options?: ClientRenderOptions): Promise<void> {
        if (!options) options = {}

        return renderNextSnippetAsync(options.snippetClass, (c, r) => {
            let s = r.compileBlocks && r.compileBlocks.success ? r.blocksSvg : undefined;
            let js = $('<code/>').text(c.text().trim());
            if (options.snippetReplaceParent) c = c.parent();
            fillWithWidget(c, js, s);
        }).then(() => renderNextSnippetAsync(options.signatureClass, (c, r) => {
            let cjs = r.compileJS;
            if (!cjs) return;
            let file = r.compileJS.ast.getSourceFile("main.ts");
            let stmts = file.statements;
            let stmt = stmts[0] as ts.ExpressionStatement;
            if (!stmt) {
                console.error('missing statement')
                return;
            }

            let s = r.compileBlocks && r.compileBlocks.success ? r.blocksSvg : undefined;
            let call = stmt.expression as ts.CallExpression;
            let info = (<any>call).callInfo as ts.ks.CallInfo
            if (info) {
                let sig = info.decl.getText().replace(/^export/, '');
                sig = sig.slice(0, sig.indexOf('{')).trim() + ';';
                let js = $('<code/>').text(sig)
                if (options.snippetReplaceParent) c = c.parent();
                fillWithWidget(c, js, s);
            }
        })).then(() => renderNextSnippetAsync(options.blocksClass, (c, r) => {
            let s = r.blocksSvg;
            if (options.snippetReplaceParent) c = c.parent();
            c.replaceWith(s);
        }));
    }
}