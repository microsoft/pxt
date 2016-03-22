namespace ks.runner {

    export interface ClientRenderOptions {
        snippetClass?: string;
        signatureClass?: string;
        snippetReplaceParent?: boolean;
    }
    
    function fillWithWidget($container: JQuery, $js: JQuery, $svg: JQuery) {
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

    function renderNextSnippetAsync(cls: string, render: (container: JQuery, r : ks.runner.DecompileResult) => void): Promise<void> {
        if (!cls) return Promise.resolve();
        
        let $el = $("." + cls).first();
        if (!$el[0]) return Promise.resolve();

        $el.removeClass(cls);
        return ks.runner.decompileToBlocksAsync($el.text())
            .then((r) => {
                if (r.blocksSvg && r.blocksSvg[0]) 
                try {
                    render($el, r);
                } catch(e) {
                    console.error('error while rendering ' + $el.html())
                }
                return renderNextSnippetAsync(cls, render);
            })
    }

    export function renderAsync(options?: ClientRenderOptions): Promise<void> {
        if (!options) options = {
            snippetClass: 'lang-blocks',
            signatureClass: 'lang-sig'
        }

        return renderNextSnippetAsync(options.snippetClass, (c, r) => {
            let s = r.blocksSvg;
            let js = $('<code/>').text(c.text().trim());
            if (options.snippetReplaceParent) c = c.parent();
            fillWithWidget(c, js, s);
        }).then(() => renderNextSnippetAsync(options.signatureClass, (c, r) => {
            let s = r.blocksSvg;
            let file = r.compileJS.ast.getSourceFile("main.ts");
            let stmts = file.statements;
            let stmt = stmts[0] as ts.ExpressionStatement;
            if (!stmt) {
                console.error('missing statement')
                return;
            }
            let call = stmt.expression as ts.CallExpression;
            let info = (<any>call).callInfo as ts.ks.CallInfo
            if (info) {
                let js = $('<code/>').text(info.decl.getText().replace(/^export/, '').replace(/\s*\{.*$/,';'))
                if (options.snippetReplaceParent) c = c.parent();
                fillWithWidget(c, js, s);
            }
        }))
    }
}