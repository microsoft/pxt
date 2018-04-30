
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
                const code = langBlock.innerText;
                langBlock.innerHTML = `<div class="ui segment raised loading"></div>`;
                if (MarkedContent.blockSnippetCache[code]) {
                    // Use cache
                    langBlock.innerHTML = `<div class="ui segment raised">
                                <img src="${MarkedContent.blockSnippetCache[code]}" /></div>`;
                } else {
                    parent.renderBlocksAsync({
                        action: "renderblocks", ts: code
                    } as pxt.editor.EditorMessageRenderBlocksRequest)
                        .done((xml) => {
                            if (xml) {
                                langBlock.innerHTML = `<div class="ui segment raised">
                                    <img src="${pxt.Util.htmlEscape(xml)}" /></div>`;
                                MarkedContent.blockSnippetCache[code] = pxt.Util.htmlEscape(xml);
                            } else {
                                // An error occured, show alternate message
                                langBlock.innerHTML = `<div class="ui segment raised">
                                    <span>${lf("Oops, something went wrong trying to render this block snippet.")}</span></div>`;
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
                    const lev = mbtn[1].length == 1 ? `docs inlinebutton ui button ${txt.toLowerCase()}-button` : `docs inlineblock ${ns}`;
                    inlineBlock.innerHTML = `<span class="${lev}">${pxt.Util.htmlEscape(pxt.U.rlf(txt))}</span>`
                }
            })
    }

    renderMarkdown(markdown: string) {
        const content = this.refs["marked-content"] as HTMLDivElement;
        const pubinfo = this.getBuiltinMacros();

        // replace pre-template in markdown
        markdown = markdown.replace(/@([a-z]+)@/ig, (m, param) => pubinfo[param] || 'unknown macro')

        // Render the markdown and add it to the content div
        content.innerHTML = marked(markdown);

        // We'll go through a series of adjustments here, rendering inline blocks, blocks and snippets as needed
        this.renderInlineBlocks(content);
        this.renderSnippets(content);
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