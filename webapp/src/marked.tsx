/// <reference path='../../localtypings/dompurify.d.ts' />

import * as React from "react";
import * as data from "./data";
import * as marked from "marked";
import * as compiler from "./compiler"

type ISettingsProps = pxt.editor.ISettingsProps;

interface MarkedContentProps extends ISettingsProps {
    markdown: string;
    className?: string;
    // do not emit segment around snippets
    unboxSnippets?: boolean;
    blocksDiffOptions?: pxt.blocks.DiffOptions;
    textDiffOptions?: pxt.diff.RenderOptions;
    onDidRender?: () => void;
}

interface MarkedContentState {
}

export class MarkedContent extends data.Component<MarkedContentProps, MarkedContentState> {

    // Local cache for images, cleared when we create a new project.
    // Stores code => data-uri image of decompiled result
    private static blockSnippetCache: pxt.Map<string | HTMLElement> = {};
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

    private startRenderLangSnippet(langBlock: HTMLElement): HTMLDivElement {
        const { unboxSnippets } = this.props;
        const preBlock = langBlock.parentElement as HTMLPreElement; // pre parent of the code
        const parentBlock = preBlock.parentElement as HTMLDivElement; // parent containing all text

        const wrapperDiv = document.createElement('div');
        wrapperDiv.className = `ui ${unboxSnippets ? "" : "segment raised "}loading codewidget`;
        parentBlock.insertBefore(wrapperDiv, preBlock);
        parentBlock.removeChild(preBlock);

        return wrapperDiv;
    }

    private finishRenderLangSnippet(wrapperDiv: HTMLDivElement, code: string | HTMLElement) {
        if (typeof code === "string") {
            let codeDiv = document.createElement('code') as HTMLElement
            codeDiv.className = "hljs"
            codeDiv.textContent = code;
            pxt.tutorial.highlight(codeDiv);
            code = codeDiv;
        }
        wrapperDiv.appendChild(code);
        pxsim.U.removeClass(wrapperDiv, 'loading');
    }

    private cachedRenderLangSnippetAsync(langBlock: HTMLElement, renderer: (code: string) => Promise<string | HTMLElement>): Promise<void> {
        const code = langBlock.textContent;
        const wrapperDiv = this.startRenderLangSnippet(langBlock);
        if (MarkedContent.blockSnippetCache[code]) {
            this.finishRenderLangSnippet(wrapperDiv, MarkedContent.blockSnippetCache[code]);
            return undefined;
        } else {
            return renderer(code)
                .then(renderedCode => {
                    MarkedContent.blockSnippetCache[code] = renderedCode;
                    this.finishRenderLangSnippet(wrapperDiv, MarkedContent.blockSnippetCache[code]);
                }).catch(e => {
                    pxt.reportException(e);
                    this.finishRenderLangSnippet(wrapperDiv, lf("Something changed."))
                })
        }
    }

    private renderSnippets(content: HTMLElement) {
        const { parent, unboxSnippets, onDidRender, blocksDiffOptions, textDiffOptions } = this.props;

        let promises: Promise<void>[] = [];

        pxt.Util.toArray(content.querySelectorAll(`img`))
            .forEach((imgBlock: HTMLImageElement) => {
                promises.push(new Promise<void>((resolve, reject) => {
                    imgBlock.addEventListener("load", () => resolve(), false);
                    imgBlock.addEventListener("error", () => resolve(), false);
                }))
            });

        pxt.Util.toArray(content.querySelectorAll(`code.lang-typescript,code.lang-python`))
            .forEach((langBlock: HTMLElement) => {
                const code = langBlock.textContent;
                const wrapperDiv = this.startRenderLangSnippet(langBlock);
                this.finishRenderLangSnippet(wrapperDiv, code);
            });

        pxt.Util.toArray(content.querySelectorAll(`code.lang-spy`))
            .forEach((langBlock: HTMLElement) => {
                promises.push(this.cachedRenderLangSnippetAsync(langBlock, code =>
                    parent.renderPythonAsync({
                        type: "pxteditor",
                        action: "renderpython", ts: code
                    }).then(resp => resp.python)
                ));
            });

        pxt.Util.toArray(content.querySelectorAll(`code.lang-diffspy`))
            .forEach((langBlock: HTMLElement) => {
                promises.push(this.cachedRenderLangSnippetAsync(langBlock, code => {
                    const { fileA, fileB } = pxt.diff.split(code);
                    return Promise.mapSeries([fileA, fileB],
                        src => parent.renderPythonAsync({
                            type: "pxteditor",
                            action: "renderpython", ts: src
                        }).then(resp => resp.python))
                        .then(parts => {
                            const el = pxt.diff.render(parts[0], parts[1], textDiffOptions || {
                                hideLineNumbers: true,
                                hideMarkerLine: true,
                                hideMarker: true,
                                hideRemoved: true,
                                update: true,
                                ignoreWhitespace: true
                            });
                            return el;
                        });
                }));
            });

        pxt.Util.toArray(content.querySelectorAll(`code.lang-diff,code.lang-diffpython`))
            .forEach((langBlock: HTMLElement) => {
                promises.push(this.cachedRenderLangSnippetAsync(langBlock, code => {
                    const { fileA, fileB } = pxt.diff.split(code);
                    const el = pxt.diff.render(fileA, fileB, textDiffOptions || {
                        hideLineNumbers: true,
                        hideMarkerLine: true,
                        hideMarker: true,
                        hideRemoved: true,
                        update: true,
                        ignoreWhitespace: true
                    });
                    return Promise.resolve(el);
                }))
            });

        pxt.Util.toArray(content.querySelectorAll(`code.lang-blocks`))
            .forEach((langBlock: HTMLElement) => renderBlock(langBlock, false));
        pxt.Util.toArray(content.querySelectorAll(`code.lang-block`)) // snippet mode
            .forEach((langBlock: HTMLElement) => renderBlock(langBlock, true));

        pxt.Util.toArray(content.querySelectorAll(`code.lang-diffblocksxml`))
            .forEach((langBlock: HTMLElement) => {
                // Can't use innerHTML here because it escapes certain characters (e.g. < and >)
                // Also can't use innerText because IE strips out the newlines from the code
                // textContent seems to work in all browsers and return the "pure" text
                const code = langBlock.textContent;
                const { fileA: oldXml, fileB: newXml } = pxt.diff.split(code);

                promises.push(this.cachedRenderLangSnippetAsync(langBlock, code =>
                    pxt.BrowserUtils.loadBlocklyAsync()
                        .then(() => {
                            const diff = pxt.blocks.diffXml(oldXml, newXml, blocksDiffOptions);
                            return wrapBlockDiff(diff);
                        })));
            });

        pxt.Util.toArray(content.querySelectorAll(`code.lang-diffblocks`))
            .forEach((langBlock: HTMLElement) => {
                // Can't use innerHTML here because it escapes certain characters (e.g. < and >)
                // Also can't use innerText because IE strips out the newlines from the code
                // textContent seems to work in all browsers and return the "pure" text
                const code = langBlock.textContent;
                const { fileA: oldSrc, fileB: newSrc } = pxt.diff.split(code);


                promises.push(this.cachedRenderLangSnippetAsync(langBlock, code =>
                    pxt.BrowserUtils.loadBlocklyAsync()
                        .then(() => compiler.getBlocksAsync())
                        .then(blocksInfo => Promise.mapSeries([oldSrc, newSrc], src =>
                            compiler.decompileBlocksSnippetAsync(src, blocksInfo))
                        )
                        .then((resps) => pxt.blocks.decompiledDiffAsync(oldSrc, resps[0], newSrc, resps[1], blocksDiffOptions || {
                            hideDeletedTopBlocks: true,
                            hideDeletedBlocks: true
                        }))
                        .then(diff => wrapBlockDiff(diff))
                ));
            });

        promises = promises.filter(p => !!p);
        if (promises.length && onDidRender)
            Promise.all(promises)
                .then(() => {
                    pxt.log(`markdowcontent: forcing update after async rendering`)
                    onDidRender();
                });

        function wrapBlockDiff(diff: pxt.blocks.DiffResult): HTMLElement {
            const svg = diff.svg;
            if (svg) {
                if (svg.tagName == "SVG") { // splitsvg
                    const viewBox = svg.getAttribute('viewBox').split(' ').map(parseFloat);
                    const width = viewBox[2];
                    let height = viewBox[3];
                    if (width > 480 || height > 128)
                        height = (height * 0.8) | 0;
                    svg.setAttribute('height', `${height}px`);
                }
                return svg as HTMLElement;
            } else {
                // An error occured, show alternate message
                const textDiv = document.createElement('div');
                textDiv.className = "ui basic segment";
                textDiv.textContent = diff.message || lf("No changes.");
                return textDiv;
            }
        }

        function renderBlock(langBlock: HTMLElement, snippetMode: boolean) {
            // Can't use innerHTML here because it escapes certain characters (e.g. < and >)
            // Also can't use innerText because IE strips out the newlines from the code
            // textContent seems to work in all browsers and return the "pure" text
            const code = langBlock.textContent;

            const wrapperDiv = document.createElement('div');
            pxsim.U.clear(langBlock);
            langBlock.appendChild(wrapperDiv);
            wrapperDiv.className = `ui ${unboxSnippets ? "" : "segment raised "} loading`;
            const req: pxt.editor.EditorMessageRenderBlocksRequest = {
                type: "pxteditor",
                action: "renderblocks",
                ts: code,
                snippetMode
            };
            const reqid = JSON.stringify(req);
            if (MarkedContent.blockSnippetCache[reqid]) {
                // Use cache
                const workspaceXml = MarkedContent.blockSnippetCache[reqid] as string;
                const doc = Blockly.utils.xml.textToDomDocument(pxt.blocks.layout.serializeSvgString(workspaceXml));
                wrapperDiv.appendChild(doc.documentElement);
                pxsim.U.removeClass(wrapperDiv, 'loading');
            } else {
                promises.push(parent.renderBlocksAsync(req).then(resp => {
                    const svg = resp.svg;
                    if (svg) {
                        const viewBox = svg.getAttribute('viewBox').split(' ').map(parseFloat);
                        const width = viewBox[2];
                        let height = viewBox[3];
                        if (width > 480 || height > 128)
                            height = (height * 0.8) | 0;
                        svg.setAttribute('height', `${height}px`);
                        // SVG serialization is broken on IE (SVG namespace issue), don't cache on IE
                        if (!pxt.BrowserUtils.isIE()) MarkedContent.blockSnippetCache[reqid] = Blockly.Xml.domToText(svg);
                        wrapperDiv.appendChild(svg);
                        pxsim.U.removeClass(wrapperDiv, 'loading');
                    } else {
                        // An error occured, show alternate message
                        const textDiv = document.createElement('span');
                        textDiv.textContent = lf("Oops, something went wrong trying to render this block snippet.");
                        wrapperDiv.appendChild(textDiv);
                        pxsim.U.removeClass(wrapperDiv, 'loading');
                    }
                }));
            }
        }
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
        pxt.Util.toArray(content.querySelectorAll(`.lang-package,.lang-config,.lang-apis`))
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

        // always popout external links
        const linkRenderer = renderer.link;
        renderer.link = function (href: string, title: string, text: string) {
            const relative = /^[\/#]/.test(href);
            const target = !relative ? '_blank' : '';
            const html = linkRenderer.call(renderer, href, title, text);
            return html.replace(/^<a /, `<a ${target ? `target="${target}"` : ''} rel="nofollow noopener" `);
        };

        // Set markdown options
        marked.setOptions({
            renderer: renderer,
            sanitize: true,
            sanitizer: pxt.docs.requireDOMSanitizer()
        })

        // preemptively remove script tags, although they'll be escaped anyway
        // prevents ugly <script ...> rendering in docs
        markdown = markdown.replace(/<\s*script[^>]*>.*<\/\s*script\s*>/g, '');

        // Render the markdown and add it to the content div
        /* tslint:disable:no-inner-html (marked content is already sanitized) */
        content.innerHTML = marked(markdown);
        /* tslint:enable:no-inner-html */

        //

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
        const { className } = this.props;
        return <div ref="marked-content" className={className || ""} />;
    }
}