namespace ks.runner {

    export interface ClientRenderOptions {
        snippetClass?: string;
        snippetReplaceParent?: boolean;
    }

    export function renderAsync(container: HTMLElement, options?: ClientRenderOptions) : Promise<void> {
        if (!options) options = {
            snippetClass: 'lang-blocks'
        }
        
        return renderSnippetsAsync();

        function renderSnippetsAsync() : Promise<void> {

            let $el = $("." + options.snippetClass).first();
            if (!$el[0]) return Promise.resolve();

            $el.removeClass(options.snippetClass);
            return ks.runner.decompileToBlocksAsync($el.text())
                .then(($svg) => {
                    if ($svg && $svg[0]) {
                        let $js = $el;
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
                        let parent = $el;
                        if (options.snippetReplaceParent) parent = $el.parent();
                        parent.replaceWith([$c, $h]);
                    }
                    return renderSnippetsAsync()
                })
        }
    }
}