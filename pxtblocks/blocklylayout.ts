
namespace pxt.blocks.layout {
    export interface FlowOptions {
        ratio?: number;
        useViewWidth?: boolean;
    }

    export function patchBlocksFromOldWorkspace(blockInfo: ts.pxtc.BlocksInfo, oldWs: Blockly.Workspace, newXml: string): string {
        const newWs = pxt.blocks.loadWorkspaceXml(newXml, true);
        // position blocks
        alignBlocks(blockInfo, oldWs, newWs);
        // inject disabled blocks
        return injectDisabledBlocks(oldWs, newWs);
    }

    function injectDisabledBlocks(oldWs: Blockly.Workspace, newWs: Blockly.Workspace): string {
        const oldDom = Blockly.Xml.workspaceToDom(oldWs, true);
        const newDom = Blockly.Xml.workspaceToDom(newWs, true);
        Util.toArray(oldDom.childNodes)
            .filter(n => n.nodeType == Node.ELEMENT_NODE && n.localName == "block" && (<Element>n).getAttribute("disabled") == "true")
            .forEach(n => newDom.appendChild(newDom.ownerDocument.importNode(n, true)));
        const updatedXml = Blockly.Xml.domToText(newDom);
        return updatedXml;
    }

    function alignBlocks(blockInfo: ts.pxtc.BlocksInfo, oldWs: Blockly.Workspace, newWs: Blockly.Workspace) {
        let env: pxt.blocks.Environment;
        let newBlocks: pxt.Map<Blockly.Block[]>; // support for multiple events with similar name
        oldWs.getTopBlocks(false).filter(ob => !ob.disabled)
            .forEach(ob => {
                const otp = ob.xy_;
                if (otp && otp.x != 0 && otp.y != 0) {
                    if (!env) {
                        env = pxt.blocks.mkEnv(oldWs, blockInfo);
                        newBlocks = {};
                        newWs.getTopBlocks(false).forEach(b => {
                            const nkey = pxt.blocks.callKey(env, b);
                            const nbs = newBlocks[nkey] || [];
                            nbs.push(b);
                            newBlocks[nkey] = nbs;
                        });
                    }
                    const oldKey = pxt.blocks.callKey(env, ob);
                    const newBlock = (newBlocks[oldKey] || []).shift();
                    if (newBlock)
                        newBlock.xy_ = otp.clone();
                }
            })
    }

    declare function unescape(escapeUri: string): string;

    /**
     * Splits a blockly SVG AFTER a vertical layout. This function relies on the ordering
     * of blocks / comments to get as getTopBlock(true)/getTopComment(true)
     */
    export function splitSvg(svg: SVGSVGElement, ws: Blockly.WorkspaceSvg, emPixels: number = 18): Element {
        const comments = ws.getTopComments(true) as Blockly.WorkspaceCommentSvg[];
        const blocks = ws.getTopBlocks(true) as Blockly.BlockSvg[];
        // don't split for a single block
        if (comments.length + blocks.length < 2)
            return svg;

        const div = document.createElement("div") as HTMLDivElement;
        div.className = "blocks-svg-list"

        function extract(
            parentClass: string,
            otherClass: string,
            blocki: number,
            size: { height: number, width: number },
            translate: { x: number, y: number }
        ) {
            const svgclone = svg.cloneNode(true) as SVGSVGElement;
            // collect all blocks
            const parentSvg = svgclone.querySelector(`g.blocklyWorkspace > g.${parentClass}`) as SVGGElement;
            const otherSvg = svgclone.querySelector(`g.blocklyWorkspace > g.${otherClass}`) as SVGGElement;
            const blocksSvg = Util.toArray(parentSvg.querySelectorAll(`g.blocklyWorkspace > g.${parentClass} > g`));
            const blockSvg = blocksSvg.splice(blocki, 1)[0];
            if (!blockSvg) {
                // seems like no blocks were generated
                pxt.log(`missing block, did block failed to load?`)
                return;
            }
            // remove all but the block we care about
            blocksSvg.filter(g => g != blockSvg)
                .forEach(g => {
                    g.parentNode.removeChild(g);
                });
            // clear transform, remove other group
            parentSvg.removeAttribute("transform");
            otherSvg.parentNode.removeChild(otherSvg);
            // patch size
            blockSvg.setAttribute("transform", `translate(${translate.x}, ${translate.y})`)
            const width = (size.width / emPixels) + "em";
            const height = (size.height / emPixels) + "em";
            svgclone.setAttribute("viewBox", `0 0 ${size.width} ${size.height}`)
            svgclone.style.width = width;
            svgclone.style.height = height;
            svgclone.setAttribute("width", width);
            svgclone.setAttribute("height", height);
            div.appendChild(svgclone);
        }

        comments.forEach((comment, commenti) => extract('blocklyBubbleCanvas', 'blocklyBlockCanvas',
            commenti, comment.getHeightWidth(), { x: 0, y: 0 }));
        blocks.forEach((block, blocki) => {
                const size = block.getHeightWidth();
                const translate = { x: 0, y: 0 };
                if (block.getStartHat()) {
                    size.height += emPixels;
                    translate.y += emPixels;
                }
                extract('blocklyBlockCanvas', 'blocklyBubbleCanvas',
                    blocki, size, translate)
            });
        return div;
    }

    export function verticalAlign(ws: Blockly.WorkspaceSvg, emPixels: number) {
        let y = 0
        let comments = ws.getTopComments(true) as Blockly.WorkspaceCommentSvg[];
        comments.forEach(comment => {
            comment.moveBy(0, y)
            y += comment.getHeightWidth().height
            y += emPixels; //buffer
        })
        let blocks = ws.getTopBlocks(true) as Blockly.BlockSvg[];
        blocks.forEach((block, bi) => {
            // TODO: REMOVE THIS WHEN FIXED IN PXT-BLOCKLY
            if (block.getStartHat())
                y += emPixels; // hat height
            block.moveBy(0, y)
            y += block.getHeightWidth().height
            y += emPixels; //buffer
        })
    };

    export function flow(ws: Blockly.WorkspaceSvg, opts?: FlowOptions) {
        if (opts) {
            if (opts.useViewWidth) {
                const metrics = ws.getMetrics();

                // Only use the width if in portrait, otherwise the blocks are too spread out
                if (metrics.viewHeight > metrics.viewWidth) {
                    flowBlocks(ws.getTopComments(true) as Blockly.WorkspaceCommentSvg[], ws.getTopBlocks(true) as Blockly.BlockSvg[], undefined, metrics.viewWidth)
                    return;
                }
            }
            flowBlocks(ws.getTopComments(true) as Blockly.WorkspaceCommentSvg[], ws.getTopBlocks(true) as Blockly.BlockSvg[], opts.ratio);
        }
        else {
            flowBlocks(ws.getTopComments(true) as Blockly.WorkspaceCommentSvg[], ws.getTopBlocks(true) as Blockly.BlockSvg[]);
        }
    }

    export function screenshotEnabled(): boolean {
        return !BrowserUtils.isIE()
            && !BrowserUtils.isUwpEdge(); // TODO figure out why screenshots are not working in UWP; disable for now
    }

    export function screenshotAsync(ws: Blockly.Workspace): Promise<string> {
        return toPngAsync(ws);
    }

    export function toPngAsync(ws: Blockly.Workspace): Promise<string> {
        return toSvgAsync(ws)
            .then(sg => {
                if (!sg) return Promise.resolve<string>(undefined);
                return toPngAsyncInternal(sg.width, sg.height, 4, sg.xml);
            });
    }

    const MAX_SCREENSHOT_SIZE = 1e6; // max 1Mb
    function toPngAsyncInternal(width: number, height: number, pixelDensity: number, data: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const cvs = document.createElement("canvas") as HTMLCanvasElement;
            const ctx = cvs.getContext("2d");
            const img = new Image;

            cvs.width = width * pixelDensity;
            cvs.height = height * pixelDensity;
            img.onload = function () {
                ctx.drawImage(img, 0, 0, width, height, 0, 0, cvs.width, cvs.height);
                let canvasdata = cvs.toDataURL("image/png");
                // if the generated image is too big, shrink image
                while (canvasdata.length > MAX_SCREENSHOT_SIZE) {
                    cvs.width = (cvs.width / 2) >> 0;
                    cvs.height = (cvs.height / 2) >> 0;
                    pxt.log(`screenshot size ${canvasdata.length}b, shrinking to ${cvs.width}x${cvs.height}`)
                    ctx.drawImage(img, 0, 0, width, height, 0, 0, cvs.width, cvs.height);
                    canvasdata = cvs.toDataURL("image/png");
                }
                resolve(canvasdata);
            };
            img.onerror = ev => {
                pxt.reportError("blocks", "blocks screenshot failed");
                resolve(undefined)
            }
            img.src = data;
        })
    }

    const XLINK_NAMESPACE = "http://www.w3.org/1999/xlink";

    export function toSvgAsync(ws: Blockly.Workspace): Promise<{
        width: number; height: number; xml: string;
    }> {
        if (!ws)
            return Promise.resolve<{ width: number; height: number; xml: string; }>(undefined);

        const metrics = (ws as any).getBlocksBoundingBox();
        const sg = (ws as any).getParentSvg().cloneNode(true) as SVGElement;
        cleanUpBlocklySvg(sg);

        return blocklyToSvgAsync(sg, metrics.x, metrics.y, metrics.width, metrics.height);
    }

    export function serializeNode(sg: Node): string {
        return serializeSvgString(new XMLSerializer().serializeToString(sg));
    }

    export function serializeSvgString(xmlString: string): string {
        return xmlString
            .replace(new RegExp('&nbsp;', 'g'), '&#160;'); // Replace &nbsp; with &#160; as a workaround for having nbsp missing from SVG xml
    }

    export interface BlockSvg {
        width: number; height: number; svg: string; xml: string; css: string;
    }

    export function cleanUpBlocklySvg(svg: SVGElement): SVGElement {
        Blockly.utils.removeClass(svg as Element, "blocklySvg");
        Blockly.utils.addClass(svg as Element, "blocklyPreview");

        pxt.U.toArray(svg.querySelectorAll('.blocklyMainBackground,.blocklyScrollbarBackground'))
            .forEach(el => { if (el) el.parentNode.removeChild(el) });

        svg.removeAttribute('width');
        svg.removeAttribute('height');

        pxt.U.toArray(svg.querySelectorAll('.blocklyBlockCanvas,.blocklyBubbleCanvas'))
            .forEach(el => el.removeAttribute('transform'));

        // In order to get the Blockly comment's text area to serialize properly they have to have names
        const parser = new DOMParser();
        pxt.U.toArray(svg.querySelectorAll('.blocklyCommentTextarea'))
            .forEach(el => {
                const dom = parser.parseFromString(
                    '<!doctype html><body>' + pxt.docs.html2Quote((el as any).value),
                    'text/html');
                (el as any).textContent = dom.body.textContent;
            });

        return svg;
    }

    export function blocklyToSvgAsync(sg: SVGElement, x: number, y: number, width: number, height: number): Promise<BlockSvg> {
        if (!sg.childNodes[0])
            return Promise.resolve<BlockSvg>(undefined);

        sg.removeAttribute("width");
        sg.removeAttribute("height");
        sg.removeAttribute("transform");

        const xmlString = serializeNode(sg)
            .replace(/^\s*<svg[^>]+>/i, '')
            .replace(/<\/svg>\s*$/i, '') // strip out svg tag
        const svgXml = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="${XLINK_NAMESPACE}" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}">${xmlString}</svg>`;
        const xsg = new DOMParser().parseFromString(svgXml, "image/svg+xml");
        const cssLink = xsg.createElementNS("http://www.w3.org/1999/xhtml", "style");
        const isRtl = Util.isUserLanguageRtl();
        const customCssHref = (document.getElementById(`style-${isRtl ? 'rtl' : ''}blockly.css`) as HTMLLinkElement).href;
        return pxt.BrowserUtils.loadAjaxAsync(customCssHref)
            .then((customCss) => {
                const blocklySvg = Util.toArray(document.head.querySelectorAll("style"))
                    .filter((el: HTMLStyleElement) => /\.blocklySvg/.test(el.innerText))[0] as HTMLStyleElement;
                // CSS may contain <, > which need to be stored in CDATA section
                const cssString = (blocklySvg ? blocklySvg.innerText : "") + '\n\n' + customCss + '\n\n';
                cssLink.appendChild(xsg.createCDATASection(cssString));
                xsg.documentElement.insertBefore(cssLink, xsg.documentElement.firstElementChild);

                return expandImagesAsync(xsg)
                    .then(() => convertIconsToPngAsync(xsg))
                    .then(() => {
                        return <BlockSvg>{
                            width: width,
                            height: height,
                            svg: serializeNode(xsg).replace('<style xmlns="http://www.w3.org/1999/xhtml">', '<style>'),
                            xml: documentToSvg(xsg),
                            css: cssString
                        };
                    });
            })
    }

    export function documentToSvg(xsg: Node): string {
        const xml = new XMLSerializer().serializeToString(xsg);
        const data = "data:image/svg+xml;base64," + ts.pxtc.encodeBase64(unescape(encodeURIComponent(xml)));
        return data;
    }

    let imageXLinkCache: pxt.Map<string>;
    function expandImagesAsync(xsg: Document): Promise<void> {
        if (!imageXLinkCache) imageXLinkCache = {};

        const images = xsg.getElementsByTagName("image") as NodeListOf<Element>;
        const p = pxt.Util.toArray(images)
            .filter(image => {
                const href = image.getAttributeNS(XLINK_NAMESPACE, "href");
                return href && !/^data:/.test(href);
            })
            .map((image: HTMLImageElement) => {
                const href = image.getAttributeNS(XLINK_NAMESPACE, "href");
                let dataUri = imageXLinkCache[href];
                return (dataUri ? Promise.resolve(imageXLinkCache[href])
                    : pxt.BrowserUtils.loadImageAsync(image.getAttributeNS(XLINK_NAMESPACE, "href"))
                        .then((img: HTMLImageElement) => {
                            const cvs = document.createElement("canvas") as HTMLCanvasElement;
                            const ctx = cvs.getContext("2d");
                            cvs.width = img.width;
                            cvs.height = img.height;
                            ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, cvs.width, cvs.height);
                            imageXLinkCache[href] = dataUri = cvs.toDataURL("image/png");
                            return dataUri;
                        }).catch(e => {
                            // ignore load error
                            pxt.debug(`svg render: failed to load ${href}`)
                        }))
                    .then(href => { image.setAttributeNS(XLINK_NAMESPACE, "href", href); })
            });
        return Promise.all(p).then(() => { })
    }

    let imageIconCache: pxt.Map<string>;
    function convertIconsToPngAsync(xsg: Document): Promise<void> {
        if (!imageIconCache) imageIconCache = {};

        if (!BrowserUtils.isEdge()) return Promise.resolve();

        const images = xsg.getElementsByTagName("image") as NodeListOf<Element>;
        const p = pxt.Util.toArray(images)
            .filter(image => /^data:image\/svg\+xml/.test(image.getAttributeNS(XLINK_NAMESPACE, "href")))
            .map((image: HTMLImageElement) => {
                const svgUri = image.getAttributeNS(XLINK_NAMESPACE, "href");
                const width = parseInt(image.getAttribute("width").replace(/[^0-9]/g, ""));
                const height = parseInt(image.getAttribute("height").replace(/[^0-9]/g, ""));
                let pngUri = imageIconCache[svgUri];

                return (pngUri ? Promise.resolve(pngUri)
                    : toPngAsyncInternal(width, height, 4, svgUri))
                    .then(href => {
                        imageIconCache[svgUri] = href;
                        image.setAttributeNS(XLINK_NAMESPACE, "href", href);
                    })
            });
        return Promise.all(p).then(() => { })
    }

    interface Formattable {
        value: Blockly.BlockSvg | Blockly.WorkspaceCommentSvg;
        children?: Formattable[];
        width: number;
        height: number;

        // Relative to parent (if any)
        x?: number;
        y?: number;
    }

    function flowBlocks(comments: Blockly.WorkspaceCommentSvg[], blocks: Blockly.BlockSvg[], ratio: number = 1.62, maxWidth?: number) {
        // Margin between blocks and their comments
        const innerGroupMargin = 13;

        // Margin between groups of blocks and comments
        const outerGroupMargin = 45;

        // Workspace margins
        const marginx = 20;
        const marginy = 20;

        const groups: Formattable[] = [];
        const commentMap: Map<Blockly.WorkspaceCommentSvg> = {};

        comments.forEach(comment => {
            const ref: string = (comment as any).data;
            if (ref != undefined) {
                commentMap[ref] = comment;
            }
            else {
                groups.push(formattable(comment));
            }
        });

        let onStart: Formattable;

        blocks.forEach(block => {
            const commentRefs = (block as any).data;
            if (commentRefs) {
                const refs = commentRefs.split(";");
                const children: Formattable[] = [];
                for (let i = 0; i < refs.length; i++) {
                    const comment = commentMap[refs[i]];
                    if (comment) {
                        children.push(formattable(comment))
                        delete commentMap[refs[i]];
                    }
                }

                if (children.length) {
                    groups.push({ value: block, width: -1, height: -1, children });
                    return;
                }
            }
            const f = formattable(block);

            if (block.type === pxtc.ON_START_TYPE) {
                onStart = f;
            }
            else {
                groups.push(f);
            }
        });

        if (onStart) {
            groups.unshift(onStart);
        }

        // Collect the comments that were not linked to a top-level block
        // and puth them in on start (if it exists)
        Object.keys(commentMap).sort((a, b) => {
            // These are strings of integers (eg "0", "17", etc.) with no duplicates
            if (a.length === b.length) {
                return a > b ? -1 : 1;
            }
            else {
                return a.length > b.length ? -1 : 1;
            }
        }).forEach(key => {
            if (commentMap[key]) {
                if (onStart) {
                    if (!onStart.children) {
                        onStart.children = [];
                    }
                    onStart.children.push(formattable(commentMap[key]));
                }
                else {
                    // Stick the comments in the front so that they show up in the top left
                    groups.unshift(formattable(commentMap[key]));
                }
            }
        });

        let surfaceArea = 0;
        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];
            if (group.children) {
                const valueDimensions = (group.value as Blockly.BlockSvg).getHeightWidth();
                group.x = 0;
                group.y = 0;

                let x = valueDimensions.width + innerGroupMargin;
                let y = 0;

                // Lay comments out to the right of the parent node
                for (let j = 0; j < group.children.length; j++) {
                    const child = group.children[j];
                    child.x = x;
                    child.y = y;
                    y += child.height + innerGroupMargin;
                    group.width = Math.max(group.width, x + child.width);
                }

                group.height = Math.max(y - innerGroupMargin, valueDimensions.height);
            }

            surfaceArea += (group.height + innerGroupMargin) * (group.width + innerGroupMargin);
        }

        let maxx: number;
        if (maxWidth > marginx) {
            maxx = maxWidth - marginx;
        }
        else {
            maxx = Math.sqrt(surfaceArea) * ratio;
        }

        let insertx = marginx;
        let inserty = marginy;
        let rowBottom = 0;

        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];
            if (group.children) {
                moveFormattable(group, insertx + group.x, inserty + group.y);
                for (let j = 0; j < group.children.length; j++) {
                    const child = group.children[j];
                    moveFormattable(child, insertx + child.x, inserty + child.y);
                }
            }
            else {
                moveFormattable(group, insertx, inserty);
            }

            insertx += group.width + outerGroupMargin;
            rowBottom = Math.max(rowBottom, inserty + group.height + outerGroupMargin);

            if (insertx > maxx) {
                insertx = marginx;
                inserty = rowBottom;
            }
        }

        function moveFormattable(f: Formattable, x: number, y: number) {
            const bounds = f.value.getBoundingRectangle();
            f.value.moveBy(x - bounds.topLeft.x, y - bounds.topLeft.y);
        }
    }

    function formattable(entity: Blockly.BlockSvg | Blockly.WorkspaceCommentSvg): Formattable {
        const hw = entity.getHeightWidth();
        return { value: entity, height: hw.height, width: hw.width }
    }
}
