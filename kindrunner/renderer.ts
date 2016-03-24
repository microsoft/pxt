namespace ks.runner {

    export interface ClientRenderOptions {
        snippetClass?: string;
        signatureClass?: string;
        blocksClass?: string;
        snippetReplaceParent?: boolean;
        simulator?: boolean;
    }

    function fillWithWidget($container: JQuery, $js: JQuery, $svg: JQuery, run : boolean) {
        if (!$svg || !$svg[0]) {
            let $c = $('<div class="ui segment"></div>');
            $c.append($js);
            $container.replaceWith($c);
            return;
        }

        let $h = $('<div class="ui bottom attached tabular icon small compact menu">'
            + ' <div class="right icon menu"></div></div>');
        let $c = $('<div class="ui top attached segment"></div>');
        let $menu = $h.find('.right.menu');

        // blocks menu
        if ($svg && $svg[0]) {
            $c.append($svg);
            let $blockBtn = $('<a class="active item"><i class="puzzle icon"></i></a>').click(() => {
                $h.find('.active').removeClass('active')
                $blockBtn.addClass('active')
                $c.empty().append($svg);
            })
            $menu.append($blockBtn);
        }

        // js menu
        {
            let $jsBtn = $('<a class="item"><i class="keyboard icon"></i></a>').click(() => {
                $h.find('.active').removeClass('active')
                $jsBtn.addClass('active')
                $c.empty().append($js);
            })
            $menu.append($jsBtn);
        }
        
        // runner menu
        if (run) {
            let $runBtn = $('<a class="item"><i class="play icon"></i></a>').click(() => {
                $h.find('.active').removeClass('active')
                $runBtn.addClass('active')
                let $frame = $('<iframe frameborder="0"/>');
                ($frame[0] as HTMLIFrameElement).src = 'https://yelm.tdev.ly/microbit---run?code=' + encodeURIComponent($js.text());
                $c.empty().append($frame);
            })
            $menu.append($runBtn);
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
            fillWithWidget(c, js, s, options.simulator && r.compileJS && r.compileJS.success);
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
                fillWithWidget(c, js, s, false);
            }
        })).then(() => renderNextSnippetAsync(options.blocksClass, (c, r) => {
            let s = r.blocksSvg;
            if (options.snippetReplaceParent) c = c.parent();
            c.replaceWith(s);
        }));
    }
}