
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as data from "./data";
import * as marked from "marked";

type ISettingsProps = pxt.editor.ISettingsProps;

interface MarkedContentProps extends ISettingsProps {
    markdown: string;
}

interface MarkedContentState {
}

export class MarkedContent extends data.Component<MarkedContentProps, MarkedContentState> {

    // Local cache for images, cleared when we create a new project.
    // Stores code => data-uri image of decompiled result
    private static blockSnippetCache: pxt.Map<string> = {};
    public static clearBlockSnippetCache() {
        this.blockSnippetCache = {};
    }

    private getBuiltinMacros() {
        const params: pxt.Map<string> = {};
        const theme = pxt.appTarget.appTheme;
        if (theme.boardName)
            params["boardname"] = pxt.Util.htmlEscape(theme.boardName);
        if (theme.boardNickname)
            params["boardnickname"] = pxt.Util.htmlEscape(theme.boardNickname);
        if (theme.driveDisplayName)
            params["drivename"] = pxt.Util.htmlEscape(theme.driveDisplayName);
        if (theme.homeUrl)
            params["homeurl"] = pxt.Util.htmlEscape(theme.homeUrl);
        params["targetid"] = theme.id || "???";
        params["targetname"] = theme.name || "Microsoft MakeCode";
        params["targetlogo"] = theme.docsLogo ? `<img aria-hidden="true" role="presentation" class="ui mini image" src="${theme.docsLogo}" />` : "";
        return params;
    }

    private renderSnippets(content: HTMLElement) {
        const { parent } = this.props;

        pxt.Util.toArray(content.querySelectorAll(`.lang-blocks`))
            .forEach((langBlock: HTMLElement) => {
                // Can't use innerHTML here because it escapes certain characters (e.g. < and >)
                // Also can't use innerText because IE strips out the newlines from the code
                // textContent seems to work in all browsers and return the "pure" text
                const code = langBlock.textContent;

                const wrapperDiv = document.createElement('div');
                pxsim.U.clear(langBlock);
                langBlock.appendChild(wrapperDiv);
                wrapperDiv.className = 'ui segment raised loading';
                if (MarkedContent.blockSnippetCache[code]) {
                    // Use cache
                    const svg = Blockly.Xml.textToDom(pxt.blocks.layout.serializeSvgString(MarkedContent.blockSnippetCache[code]));
                    wrapperDiv.appendChild(svg);
                    pxsim.U.removeClass(wrapperDiv, 'loading');
                } else {
                    parent.renderBlocksAsync({
                        action: "renderblocks", ts: code
                    } as pxt.editor.EditorMessageRenderBlocksRequest)
                        .done((resp: any) => {
                            const svg = resp.svg;
                            if (svg) {
                                svg.setAttribute('height', `${svg.getAttribute('viewBox').split(' ')[3]}px`);
                                // SVG serialization is broken on IE (SVG namespace issue), don't cache on IE
                                if (!pxt.BrowserUtils.isIE()) MarkedContent.blockSnippetCache[code] = Blockly.Xml.domToText(svg);
                                wrapperDiv.appendChild(svg);
                                pxsim.U.removeClass(wrapperDiv, 'loading');
                            } else {
                                // An error occured, show alternate message
                                const textDiv = document.createElement('span');
                                textDiv.textContent = lf("Oops, something went wrong trying to render this block snippet.");
                                wrapperDiv.appendChild(textDiv);
                                pxsim.U.removeClass(wrapperDiv, 'loading');
                            }
                        })
                }
            })
    }

    private renderInlineBlocks(content: HTMLElement) {
        pxt.Util.toArray(content.querySelectorAll(`:not(pre) > code`))
            .forEach((inlineBlock: HTMLElement) => {
                const text = inlineBlock.innerText;
                const mbtn = /^(\|+)([^\|]+)\|+$/.exec(text);
                if (mbtn) {
                    const mtxt = /^(([^\:\.]*?)[\:\.])?(.*)$/.exec(mbtn[2]);
                    const ns = mtxt[2] ? mtxt[2].trim().toLowerCase() : '';
                    const txt = mtxt[3].trim();
                    const lev = mbtn[1].length == 1 ?
                        `docs inlinebutton ui button ${pxt.Util.htmlEscape(txt.toLowerCase())}-button`
                        : `docs inlineblock ${pxt.Util.htmlEscape(ns)}`;

                    const inlineBlockDiv = document.createElement('span');
                    pxsim.U.clear(inlineBlock);
                    inlineBlock.appendChild(inlineBlockDiv);
                    inlineBlockDiv.className = lev;
                    inlineBlockDiv.textContent = pxt.U.rlf(txt);
                }
            })
    }

    private renderOthers(content: HTMLElement) {
        // remove package blocks
        pxt.Util.toArray(content.querySelectorAll(`.lang-package,.lang-config`))
            .forEach((langBlock: HTMLElement) => {
                langBlock.parentNode.removeChild(langBlock);
            });
    }

    renderMarkdown(markdown: string) {
        const content = this.refs["marked-content"] as HTMLDivElement;
        const pubinfo = this.getBuiltinMacros();

        // replace pre-template in markdown
        markdown = markdown.replace(/@([a-z]+)@/ig, (m, param) => pubinfo[param] || 'unknown macro')

        // create a custom renderer
        let renderer = new marked.Renderer()
        pxt.docs.setupRenderer(renderer);

        // Set markdown options
        marked.setOptions({
            renderer: renderer,
            sanitize: true
        })

        // Render the markdown and add it to the content div
        /* tslint:disable:no-inner-html (marked content is already sanitized) */
        content.innerHTML = marked(markdown);
        /* tslint:enable:no-inner-html */

        // We'll go through a series of adjustments here, rendering inline blocks, blocks and snippets as needed
        this.renderInlineBlocks(content);
        this.renderSnippets(content);
        this.renderOthers(content);
    }

    componentDidMount() {
        const { markdown } = this.props;
        this.renderMarkdown(markdown);
    }

    componentWillReceiveProps(newProps: MarkedContentProps) {
        const { markdown } = newProps;
        if (this.props.markdown != newProps.markdown) {
            this.renderMarkdown(markdown);
        }
    }

    renderCore() {
        return <div ref="marked-content" />;
    }
}