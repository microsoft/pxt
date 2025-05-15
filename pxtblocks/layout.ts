/// <reference path="../built/pxtlib.d.ts" />

import * as Blockly from "blockly";
import { Environment, mkEnv } from "./compiler/environment";
import { getBlockData } from "./fields";
import { callKey } from "./compiler/compiler";
import { BlockSnippet, loadWorkspaceXml, saveBlocksXml, workspaceToDom } from "./importer";

export interface FlowOptions {
    ratio?: number;
    useViewWidth?: boolean;
}

export function patchBlocksFromOldWorkspace(blockInfo: ts.pxtc.BlocksInfo, oldWs: Blockly.Workspace, newXml: string): string {
    const newWs = loadWorkspaceXml(newXml, true);
    // position blocks
    alignBlocks(blockInfo, oldWs, newWs);

    // inject disabled blocks
    const oldDom = workspaceToDom(oldWs, true);
    const newDom = workspaceToDom(newWs, true);

    for (const child of oldDom.childNodes) {
        if (
            !pxt.BrowserUtils.isElement(child) ||
            child.localName !== "block" ||
            child.getAttribute("disabled") !== "true"
        ) {
            continue;
        }

        newDom.appendChild(newDom.ownerDocument.importNode(child, true));
    }

    return Blockly.Xml.domToText(newDom);
}

function alignBlocks(blockInfo: ts.pxtc.BlocksInfo, oldWs: Blockly.Workspace, newWs: Blockly.Workspace): void {
    let env: Environment;
    let keyToBlocks: pxt.Map<Blockly.Block[]>; // support for multiple events with similar name
    const oldTopBlocks = oldWs.getTopBlocks(false).filter(ob => ob.isEnabled());
    const newTopBlocks = newWs.getTopBlocks(false);

    let textToComments: pxt.Map<Blockly.comments.WorkspaceComment[]>;
    const oldComments = oldWs.getTopComments(false);
    const newComments = newWs.getTopComments(false);

    for (const oldBlock of oldTopBlocks) {
        const oldPosition = oldBlock.getRelativeToSurfaceXY();
        if (!(oldPosition && oldPosition.x != 0 && oldPosition.y != 0)) continue;

        if (!env) {
            env = mkEnv(oldWs, blockInfo);
            keyToBlocks = {};
            for (const newBlock of newTopBlocks) {
                const newBlockKey = callKey(env, newBlock);
                const keyBlockList = keyToBlocks[newBlockKey] || [];
                keyBlockList.push(newBlock);
                keyToBlocks[newBlockKey] = keyBlockList;
            }
        }
        const oldBlockKey = callKey(env, oldBlock);
        const newBlock = (keyToBlocks[oldBlockKey] || []).shift();

        // FIXME: I don't think we're really supposed to edit the block coordinate this way
        if (newBlock) {
            const coord = newBlock.getRelativeToSurfaceXY();
            coord.x = oldPosition.x;
            coord.y = oldPosition.y;
        }
    }

    for (const oldComment of oldComments) {
        const oldPosition = oldComment.getRelativeToSurfaceXY();

        if (!(oldPosition && oldPosition.x != 0 && oldPosition.y != 0)) continue;

        if (!textToComments) {
            textToComments = {};
            for (const newComment of newComments) {
                const text = normalizeCommentText(newComment.getText());
                const keyCommentList = textToComments[text] || [];
                keyCommentList.push(newComment);
                textToComments[text] = keyCommentList;
            }
        }

        const text = normalizeCommentText(oldComment.getText());
        const newComment = (textToComments[text] || []).shift();

        if (newComment) {
            const oldSize = oldComment.getSize();
            // Restore the old comment text because sometimes the compile/decompile loop
            // can alter the whitespace a bit
            newComment.setText(oldComment.getText());
            newComment.setSize(oldSize);

            const coord = newComment.getRelativeToSurfaceXY();
            coord.x = oldPosition.x;
            coord.y = oldPosition.y;
        }
    }
}

function normalizeCommentText(text: string) {
    text = text.replace(/\n/g, "");
    return text.trim();
}

declare function unescape(escapeUri: string): string;

/**
 * Splits a blockly SVG AFTER a vertical layout. This function relies on the ordering
 * of blocks / comments to get as getTopBlock(true)/getTopComment(true)
 */
export function splitSvg(svg: SVGSVGElement, ws: Blockly.WorkspaceSvg, emPixels: number = 18): Element {
    const comments = ws.getTopComments(true) as Blockly.comments.RenderedWorkspaceComment[];
    const blocks = ws.getTopBlocks(true) as Blockly.BlockSvg[];
    // don't split for a single block
    if (comments.length + blocks.length < 2)
        return svg;

    const div = document.createElement("div") as HTMLDivElement;
    div.className = `blocks-svg-list ${ws.getInjectionDiv().className}`

    function extract(
        parentClass: string,
        otherClass: string,
        blocki: number,
        size: { height: number, width: number },
        translate: { x: number, y: number },
        ariaLabel?: string,
        itemClass?: string
    ) {
        const svgclone = svg.cloneNode(true) as SVGSVGElement;
        // collect all blocks
        const parentSvg = svgclone.querySelector(`g.blocklyWorkspace > g.${parentClass}`) as SVGGElement;
        const otherSvg = svgclone.querySelector(`g.blocklyWorkspace > g.${otherClass}`) as SVGGElement;
        const blocksSvg = pxt.Util.toArray(parentSvg.querySelectorAll(`g.blocklyWorkspace > g.${parentClass} > ${itemClass ? ("." + itemClass) : "g[transform]"}`));
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
        svgclone.setAttribute("aria-label", ariaLabel)
        div.appendChild(svgclone);
    }

    comments.forEach((comment, commenti) => extract('blocklyBubbleCanvas', 'blocklyBlockCanvas',
        commenti, comment.getSize(), { x: 0, y: 0 }, lf("blockly comment"), "blocklyComment"));
    blocks.forEach((block, blocki) => {
        const size = block.getHeightWidth();
        const translate = { x: 0, y: 0 };
        if (block.hat) {
            size.height += emPixels;
            translate.y += emPixels;
        }
        // use the block string for the most descriptive aria-label
        const label = block.toString();
        extract('blocklyBlockCanvas', 'blocklyBubbleCanvas',
            blocki, size, translate, `${label} blocks`)
    });
    return div;
}

export function verticalAlign(ws: Blockly.WorkspaceSvg, emPixels: number) {
    let y = 0
    let comments = ws.getTopComments(true) as Blockly.comments.RenderedWorkspaceComment[];
    comments.forEach(comment => {
        comment.moveBy(0, y)
        y += comment.getSize().height
        y += emPixels; //buffer
    })
    let blocks = ws.getTopBlocks(true) as Blockly.BlockSvg[];
    blocks.forEach((block, bi) => {
        // TODO: REMOVE THIS WHEN FIXED IN PXT-BLOCKLY
        if (block.hat)
            y += emPixels; // hat height
        block.moveBy(0, y)
        y += block.getHeightWidth().height
        y += emPixels; //buffer
    })
}

export function setCollapsedAll(ws: Blockly.WorkspaceSvg, collapsed: boolean) {
    ws.getTopBlocks(false)
        .filter(b => b.isEnabled())
        .forEach(b => b.setCollapsed(collapsed));
}

// Workspace margins
const marginx = 20;
const marginy = 20;
export function flow(ws: Blockly.WorkspaceSvg, opts?: FlowOptions) {
    if (opts) {
        if (opts.useViewWidth) {
            const metrics = ws.getMetrics();

            // Only use the width if in portrait, otherwise the blocks are too spread out
            if (metrics.viewHeight > metrics.viewWidth) {
                flowBlocks(ws.getTopComments(true) as Blockly.comments.RenderedWorkspaceComment[], ws.getTopBlocks(true) as Blockly.BlockSvg[], undefined, metrics.viewWidth)
                ws.scroll(marginx, marginy);
                return;
            }
        }
        flowBlocks(ws.getTopComments(true) as Blockly.comments.RenderedWorkspaceComment[], ws.getTopBlocks(true) as Blockly.BlockSvg[], opts.ratio);
    }
    else {
        flowBlocks(ws.getTopComments(true) as Blockly.comments.RenderedWorkspaceComment[], ws.getTopBlocks(true) as Blockly.BlockSvg[]);
    }
    ws.scroll(marginx, marginy);
}

export function screenshotEnabled(): boolean {
    return pxt.BrowserUtils.hasFileAccess() && !pxt.BrowserUtils.isIE();
}

export function screenshotAsync(ws: Blockly.WorkspaceSvg, pixelDensity?: number, encodeBlocks?: boolean): Promise<string> {
    return toPngAsync(ws, pixelDensity, encodeBlocks);
}

export function toPngAsync(ws: Blockly.WorkspaceSvg, pixelDensity?: number, encodeBlocks?: boolean): Promise<string> {
    let blockSnippet: BlockSnippet;
    if (encodeBlocks) {
        blockSnippet = {
            target: pxt.appTarget.id,
            versions: pxt.appTarget.versions,
            xml: saveBlocksXml(ws).map(text => pxt.Util.htmlEscape(text))
        };
    }

    const density = (pixelDensity | 0) || 4
    return toSvgAsync(ws, density)
        .then(sg => {
            if (!sg) return Promise.resolve<string>(undefined);
            return pxt.BrowserUtils.encodeToPngAsync(sg.xml,
                {
                    width: sg.width,
                    height: sg.height,
                    pixelDensity: density,
                    text: encodeBlocks ? JSON.stringify(blockSnippet, null, 2) : null
                });
        }).catch(e => {
            pxt.reportException(e);
            return undefined;
        })
}

const XLINK_NAMESPACE = "http://www.w3.org/1999/xlink";
const MAX_AREA = 120000000; // https://github.com/jhildenbiddle/canvas-size

export function toSvgAsync(ws: Blockly.WorkspaceSvg, pixelDensity: number): Promise<{
    width: number; height: number; xml: string;
}> {
    if (!ws)
        return Promise.resolve<{ width: number; height: number; xml: string; }>(undefined);

    const viewbox = ws.getBlocksBoundingBox();
    const sg = ws.getParentSvg().cloneNode(true) as SVGElement;
    cleanUpBlocklySvg(sg);

    // getBlocksBoundingBox doesn't include any expanded blocks comments, so
    // do a pass to expand the bounding box if any are present
    for (const block of ws.getAllBlocks()) {
        if (block.hasIcon(Blockly.icons.IconType.COMMENT)) {
            const icon = block.getIcon(Blockly.icons.IconType.COMMENT);
            const bubbleLocation = icon.getBubbleLocation();

            if (!bubbleLocation) continue;

            const bubbleSize = icon.getBubbleSize();
            viewbox.left = Math.min(bubbleLocation.x, viewbox.left);
            viewbox.top = Math.min(bubbleLocation.y, viewbox.top);
            viewbox.right = Math.max(bubbleLocation.x + bubbleSize.width, viewbox.right);
            viewbox.bottom = Math.max(bubbleLocation.y + bubbleSize.height, viewbox.bottom);
        }
    }

    // add 1 pixel of padding to the edges because sometimes the border
    // of blocks/comments get slightly cut off
    const PADDING = 1;

    viewbox.left -= PADDING;
    viewbox.top -= PADDING;
    viewbox.right += PADDING;
    viewbox.bottom += PADDING;

    let width = viewbox.right - viewbox.left;
    let height = viewbox.bottom - viewbox.top;
    let scale = 1;

    const area = width * height * Math.pow(pixelDensity, 2);
    if (area > MAX_AREA) {
        scale = Math.sqrt(MAX_AREA / area);
    }

    return blocklyToSvgAsync(sg, viewbox.left, viewbox.top, width, height, scale);
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
    pxt.BrowserUtils.removeClass(svg, "blocklySvg");
    pxt.BrowserUtils.addClass(svg, "blocklyPreview pxt-renderer classic-theme");

    // Remove background elements
    pxt.U.toArray(svg.querySelectorAll('.blocklyMainBackground,.blocklyScrollbarBackground'))
        .forEach(el => { if (el) el.parentNode.removeChild(el) });

    // Remove connection indicator elements
    pxt.U.toArray(svg.querySelectorAll('.blocklyConnectionIndicator,.blocklyInputConnectionIndicator'))
        .forEach(el => { if (el) el.parentNode.removeChild(el) });

    svg.removeAttribute('width');
    svg.removeAttribute('height');

    pxt.U.toArray(svg.querySelectorAll('.blocklyBlockCanvas,.blocklyBubbleCanvas'))
        .forEach(el => el.removeAttribute('transform'));

    // In order to get the Blockly comment's text area to serialize properly they have to have names
    const parser = new DOMParser();
    pxt.U.toArray(svg.querySelectorAll('.blocklyTextarea'))
        .forEach(el => {
            const dom = parser.parseFromString(
                '<!doctype html><body>' + pxt.docs.html2Quote((el as any).value),
                'text/html');
            (el as any).textContent = dom.body.textContent;
        });

    return svg;
}

export async function blocklyToSvgAsync(sg: SVGElement, x: number, y: number, width: number, height: number, scale?: number): Promise<BlockSvg> {
    if (!sg.childNodes[0])
        return undefined;

    sg.removeAttribute("width");
    sg.removeAttribute("height");
    sg.removeAttribute("transform");

    let renderWidth = Math.round(width * (scale || 1));
    let renderHeight = Math.round(height * (scale || 1));

    const xmlString = serializeNode(sg)
        .replace(/^\s*<svg[^>]+>/i, '')
        .replace(/<\/svg>\s*$/i, '') // strip out svg tag
    const svgXml = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="${XLINK_NAMESPACE}" width="${renderWidth}" height="${renderHeight}" viewBox="${x} ${y} ${width} ${height}" class="pxt-renderer classic-theme injectionDiv">${xmlString}</svg>`;
    const xsg = new DOMParser().parseFromString(svgXml, "image/svg+xml");

    const cssLink = xsg.createElementNS("http://www.w3.org/1999/xhtml", "style");
    const isRtl = pxt.Util.isUserLanguageRtl();
    const customCssHref = (document.getElementById(`style-${isRtl ? 'rtl' : ''}blockly.css`) as HTMLLinkElement).href;
    const semanticCssHref = pxt.Util.toArray(document.head.getElementsByTagName("link"))
        .filter(l => pxt.Util.endsWith(l.getAttribute("href"), "semantic.css"))[0].href;

    const customCss = await Promise.all([pxt.BrowserUtils.loadAjaxAsync(customCssHref), pxt.BrowserUtils.loadAjaxAsync(semanticCssHref)]);

    const blocklySvg = pxt.Util.toArray(document.head.querySelectorAll("style"))
        .filter((el: HTMLStyleElement) => /\.blocklySvg/.test(el.innerText))[0] as HTMLStyleElement;
    // Custom CSS injected directly into the DOM by Blockly
    customCss.unshift((document.getElementById(`blockly-common-style`) as HTMLLinkElement)?.innerText || "");
    customCss.unshift((document.getElementById(`blockly-renderer-style-pxt-classic`) as HTMLLinkElement)?.innerText || "");
    // CSS may contain <, > which need to be stored in CDATA section
    const cssString = (blocklySvg ? blocklySvg.innerText : "") + '\n\n' + customCss.map(el => el + '\n\n');
    cssLink.appendChild(xsg.createCDATASection(cssString));
    xsg.documentElement.insertBefore(cssLink, xsg.documentElement.firstElementChild);

    await expandImagesAsync(xsg);
    await convertIconsToPngAsync(xsg);

    return <BlockSvg>{
        width: renderWidth,
        height: renderHeight,
        svg: serializeNode(xsg).replace('<style xmlns="http://www.w3.org/1999/xhtml">', '<style>'),
        xml: documentToSvg(xsg),
        css: cssString
    };
}

export function documentToSvg(xsg: Node): string {
    const xml = new XMLSerializer().serializeToString(xsg);
    const data = "data:image/svg+xml;base64," + ts.pxtc.encodeBase64(unescape(encodeURIComponent(xml)));
    return data;
}

let imageXLinkCache: pxt.Map<string>;
async function expandImagesAsync(xsg: Document): Promise<void> {
    if (!imageXLinkCache) imageXLinkCache = {};

    const images = pxt.Util.toArray(xsg.getElementsByTagName("image"))
    const xlinkedImages = images
        .filter(image => {
            const href = image.getAttributeNS(XLINK_NAMESPACE, "href");
            return href && !/^data:/.test(href);
        });

    for (const image of xlinkedImages) {
        const href = image.getAttributeNS(XLINK_NAMESPACE, "href");
        let dataUri = imageXLinkCache[href];

        if (!dataUri) {
            try {
                const img = await pxt.BrowserUtils.loadImageAsync(image.getAttributeNS(XLINK_NAMESPACE, "href"));
                const cvs = document.createElement("canvas") as HTMLCanvasElement;
                const ctx = cvs.getContext("2d");
                let w = img.width
                let h = img.height
                cvs.width = w;
                cvs.height = h;
                ctx.drawImage(img, 0, 0, w, h, 0, 0, cvs.width, cvs.height);
                dataUri = cvs.toDataURL("image/png");
                imageXLinkCache[href] = dataUri;
            }
            catch (e) {
                // ignore load error
                pxt.debug(`svg render: failed to load ${href}`);
                dataUri = "";
            }
        }
        image.setAttributeNS(XLINK_NAMESPACE, "href", href);
    }

    const linkedSvgImages = images
        .filter(image => {
            const href = image.getAttribute("href");
            return href?.endsWith(".svg") &&
                (
                    href.startsWith("/") ||
                    href.startsWith(pxt.webConfig.cdnUrl)
                );
        });

    for (const image of linkedSvgImages) {
        const svgUri = image.getAttribute("href");

        // Don't love hard coding these icon values, but the comment icons set their
        // width/height using CSS so there isn't a great means of detecting it
        let width = 24;
        let height = 24;
        if (image.hasAttribute("width") && image.hasAttribute("height")) {
            width = parseInt(image.getAttribute("width").replace(/[^0-9]/g, ""));
            height = parseInt(image.getAttribute("height").replace(/[^0-9]/g, ""));
        }
        else if (image.classList.contains("blocklyResizeHandle")) {
            width = 12;
            height = 12;
        }

        let href = imageXLinkCache[svgUri];
        if (!href) {
            href = await pxt.BrowserUtils.encodeToPngAsync(svgUri, { width, height, pixelDensity: 2 });
        }

        imageXLinkCache[svgUri] = href;
        image.setAttribute("href", href);
    }
}

let imageIconCache: pxt.Map<string>;
async function convertIconsToPngAsync(xsg: Document): Promise<void> {
    if (!imageIconCache) imageIconCache = {};

    if (!pxt.BrowserUtils.isEdge()) {
        return;
    }

    const images = pxt.Util.toArray(xsg.getElementsByTagName("image"))
        .filter(image => /^data:image\/svg\+xml/.test(image.getAttributeNS(XLINK_NAMESPACE, "href")));

    for (const image of images) {
        const svgUri = image.getAttributeNS(XLINK_NAMESPACE, "href");
        const width = parseInt(image.getAttribute("width").replace(/[^0-9]/g, ""));
        const height = parseInt(image.getAttribute("height").replace(/[^0-9]/g, ""));

        let href = imageIconCache[svgUri];
        if (!href) {
            href = await pxt.BrowserUtils.encodeToPngAsync(svgUri, { width, height, pixelDensity: 2 });
            pxt.log(`HREF: ${href}`);
        }

        imageIconCache[svgUri] = href;
        image.setAttributeNS(XLINK_NAMESPACE, "href", href);
    }
}

interface Formattable {
    value: Blockly.BlockSvg | Blockly.comments.RenderedWorkspaceComment;
    children?: Formattable[];
    width: number;
    height: number;

    // Relative to parent (if any)
    x?: number;
    y?: number;
}

function flowBlocks(comments: Blockly.comments.RenderedWorkspaceComment[], blocks: Blockly.BlockSvg[], ratio: number = 1.62, maxWidth?: number) {
    // Margin between blocks and their comments
    const innerGroupMargin = 13;

    // Margin between groups of blocks and comments
    const outerGroupMargin = 45;

    const groups: Formattable[] = [];
    const commentMap: pxt.Map<Blockly.comments.RenderedWorkspaceComment> = {};

    comments.forEach(comment => {
        const ref: string = (comment as any).data;
        if (ref != undefined) {
            commentMap[ref] = comment;
        }
    });

    let onStart: Formattable;

    // Sort so that on-start is first, events are second, functions are third, and disabled blocks are last
    blocks.sort((a, b) => {
        if (a.isEnabled() === b.isEnabled()) {
            if (a.type === b.type) return 0;
            else if (a.type === "function_definition") return 1
            else if (b.type === "function_definition") return -1;
            else return a.type.localeCompare(b.type);
        }
        else if (a.isEnabled())
            return -1;
        else
            return 1
    });

    blocks.forEach(block => {
        const refs = getBlockData(block).commentRefs;
        if (refs.length) {
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

        if (!onStart && block.isEnabled() && block.type === pxtc.ON_START_TYPE) { // there might be duplicate on-start blocks
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
            // Comments go at the end after disabled blocks
            groups.push(formattable(commentMap[key]));
        }
    });

    comments.forEach(comment => {
        const ref: string = (comment as any).data;
        if (ref == undefined) {
            groups.push(formattable(comment));
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
        f.value.moveBy(x - bounds.left, y - bounds.top);
    }
}

function formattable(entity: Blockly.BlockSvg | Blockly.comments.RenderedWorkspaceComment): Formattable {
    const hw = entity instanceof Blockly.BlockSvg ? entity.getHeightWidth() : entity.getSize();
    return { value: entity, height: hw.height, width: hw.width }
}