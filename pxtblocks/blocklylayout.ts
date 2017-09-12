
namespace pxt.blocks.layout {
    export interface FlowOptions {
        ratio?: number;
        useViewWidth?: boolean;
    }

    export function patchBlocksFromOldWorkspace(blockInfo: ts.pxtc.BlocksInfo, oldWs: B.Workspace, newXml: string): string {
        const newWs = pxt.blocks.loadWorkspaceXml(newXml, true);
        // position blocks
        alignBlocks(blockInfo, oldWs, newWs);
        // inject disabled blocks
        return injectDisabledBlocks(oldWs, newWs);
    }

    function injectDisabledBlocks(oldWs: B.Workspace, newWs: B.Workspace): string {
        const oldDom = Blockly.Xml.workspaceToDom(oldWs);
        const newDom = Blockly.Xml.workspaceToDom(newWs);
        Util.toArray(oldDom.childNodes)
            .filter(n => n.nodeType == Node.ELEMENT_NODE && n.localName == "block" && (<Element>n).getAttribute("disabled") == "true")
            .forEach(n => newDom.appendChild(newDom.ownerDocument.importNode(n, true)));
        const updatedXml = Blockly.Xml.domToPrettyText(newDom);
        return updatedXml;
    }

    function alignBlocks(blockInfo: ts.pxtc.BlocksInfo, oldWs: B.Workspace, newWs: B.Workspace) {
        let env: pxt.blocks.Environment;
        let newBlocks: pxt.Map<B.Block[]>; // support for multiple events with similar name
        oldWs.getTopBlocks(false).filter(ob => !ob.disabled)
            .forEach(ob => {
                const otp = ob.xy_;
                if (otp && otp.x != 0 && otp.y != 0) {
                    if (!env) {
                        env = pxt.blocks.mkEnv(oldWs, blockInfo, true);
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

    export function verticalAlign(ws: B.Workspace, emPixels: number) {
        let blocks = ws.getTopBlocks(true);
        let y = 0
        blocks.forEach(block => {
            block.moveBy(0, y)
            y += block.getHeightWidth().height
            y += emPixels; //buffer
        })
    };

    export function shuffle(ws: B.Workspace, ratio?: number) {
        let blocks = ws.getAllBlocks().filter(b => !b.isShadow_);
        // unplug all blocks
        blocks.forEach(b => b.unplug());
        // TODO: better layout
        // randomize order
        fisherYates(blocks);
        // apply layout
        flowBlocks(blocks, ratio);
    }

    export function flow(ws: B.Workspace, opts?: FlowOptions) {
        if (opts) {
            if (opts.useViewWidth) {
                const metrics = ws.getMetrics();

                // Only use the width if in portrait, otherwise the blocks are too spread out
                if (metrics.viewHeight > metrics.viewWidth) {
                    flowBlocks(ws.getTopBlocks(true), undefined, metrics.viewWidth)
                    return;
                }
            }
            flowBlocks(ws.getTopBlocks(true), opts.ratio);
        }
        else {
            flowBlocks(ws.getTopBlocks(true));
        }
    }

    export function screenshotEnabled(): boolean {
        return !BrowserUtils.isIE()
            && !BrowserUtils.isUwpEdge(); // TODO figure out why screenshots are not working in UWP; disable for now
    }

    export function screenshotAsync(ws: B.Workspace): Promise<string> {
        return toPngAsync(ws);
    }

    export function toPngAsync(ws: B.Workspace): Promise<string> {
        return toSvgAsync(ws)
            .then(sg => {
                if (!sg) return Promise.resolve<string>(undefined);
                return toPngAsyncInternal(sg.width, sg.height, 4, sg.xml);
            });
    }

    export function svgToPngAsync(svg: SVGElement, x: number, y: number, width: number, height: number, pixelDensity: number): Promise<string> {
        return blocklyToSvgAsync(svg, x, y, width, height)
            .then(sg => {
                if (!sg) return Promise.resolve<string>(undefined);
                return toPngAsyncInternal(sg.width, sg.height, pixelDensity, sg.xml);
            });
    }

    function toPngAsyncInternal(width: number, height: number, pixelDensity: number, data: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const cvs = document.createElement("canvas") as HTMLCanvasElement;
            const ctx = cvs.getContext("2d");
            const img = new Image;

            cvs.width = width * pixelDensity;
            cvs.height = height * pixelDensity;
            img.onload = function () {
                ctx.drawImage(img, 0, 0, width, height, 0, 0, cvs.width, cvs.height);
                const canvasdata = cvs.toDataURL("image/png");
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

    export function toSvgAsync(ws: B.Workspace): Promise<{
        width: number; height: number; xml: string;
    }> {
        if (!ws)
            return Promise.resolve<{ width: number; height: number; xml: string; }>(undefined);

        const bbox = (document.getElementsByClassName("blocklyBlockCanvas")[0] as any).getBBox();
        let sg = (ws as any).svgBlockCanvas_.cloneNode(true) as SVGGElement;


        return blocklyToSvgAsync(sg, bbox.x, bbox.y, bbox.width, bbox.height);
    }

    export function blocklyToSvgAsync(sg: SVGElement, x: number, y: number, width: number, height: number): Promise<{
        width: number; height: number; xml: string;
    }> {
        if (!sg.childNodes[0])
            return Promise.resolve<{ width: number; height: number; xml: string; }>(undefined);

        sg.removeAttribute("width");
        sg.removeAttribute("height");
        sg.removeAttribute("transform");

        const xsg = new DOMParser().parseFromString(
            `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="${XLINK_NAMESPACE}" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}">
            ${new XMLSerializer().serializeToString(sg)}
            </svg>`, "image/svg+xml");
        const cssLink = xsg.createElementNS("http://www.w3.org/1999/xhtml", "style");
        const customCssHref = (document.getElementById("blocklycss") as HTMLLinkElement).href;
        return pxt.BrowserUtils.loadAjaxAsync(customCssHref)
            .then((customCss) => {

                const blocklySvg = Util.toArray(document.head.querySelectorAll("style"))
                    .filter((el: HTMLStyleElement) => /\.blocklySvg/.test(el.innerText))[0] as HTMLStyleElement;
                // CSS may contain <, > which need to be stored in CDATA section
                cssLink.appendChild(xsg.createCDATASection((blocklySvg ? blocklySvg.innerText : "") + '\n\n' + customCss + '\n\n'));
                xsg.documentElement.insertBefore(cssLink, xsg.documentElement.firstElementChild);

                return expandImagesAsync(xsg)
                    .then(() => {
                        return { width: width, height: height, xml: documentToSvg(xsg) };
                    });
            })
    }

    export function documentToSvg(xsg: Node): string {
        const xml = new XMLSerializer().serializeToString(xsg);
        const data = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
        return data;
    }

    let imageXLinkCache: pxt.Map<string>;
    function expandImagesAsync(xsg: Document): Promise<void> {
        if (!imageXLinkCache) imageXLinkCache = {};

        const images = xsg.getElementsByTagName("image") as NodeListOf<Element>;
        const p = pxt.Util.toArray(images)
            .filter(image => !/^data:/.test(image.getAttributeNS(XLINK_NAMESPACE, "href")))
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

    function flowBlocks(blocks: Blockly.Block[], ratio: number = 1.62, maxWidth?: number) {
        const gap = 16;
        const marginx = 20;
        const marginy = 20;

        let maxx: number;
        if (maxWidth > marginx) {
            maxx = maxWidth - marginx;
        }
        else {
            // compute total block surface and infer width
            let surface = 0;
            for (let block of blocks) {
                let s = block.getHeightWidth();
                surface += s.width * s.height;
            }
            maxx = Math.sqrt(surface) * ratio;
        }

        let insertx = marginx;
        let inserty = marginy;
        let endy = 0;
        for (let block of blocks) {
            let r = block.getBoundingRectangle();
            let s = block.getHeightWidth();
            // move block to insertion point
            block.moveBy(insertx - r.topLeft.x, inserty - r.topLeft.y);
            insertx += s.width + gap;
            endy = Math.max(endy, inserty + s.height + gap);
            if (insertx > maxx) { // start new line
                insertx = marginx;
                inserty = endy;
            }
        }
    }

    function robertJenkins(): () => number {
        let seed = 0x2F6E2B1;
        return function () {
            // https://gist.github.com/mathiasbynens/5670917
            // Robert Jenkins’ 32 bit integer hash function
            seed = ((seed + 0x7ED55D16) + (seed << 12)) & 0xFFFFFFFF;
            seed = ((seed ^ 0xC761C23C) ^ (seed >>> 19)) & 0xFFFFFFFF;
            seed = ((seed + 0x165667B1) + (seed << 5)) & 0xFFFFFFFF;
            seed = ((seed + 0xD3A2646C) ^ (seed << 9)) & 0xFFFFFFFF;
            seed = ((seed + 0xFD7046C5) + (seed << 3)) & 0xFFFFFFFF;
            seed = ((seed ^ 0xB55A4F09) ^ (seed >>> 16)) & 0xFFFFFFFF;
            return (seed & 0xFFFFFFF) / 0x10000000;
        }
    }

    function fisherYates<T>(myArray: T[]): void {
        let i = myArray.length;
        if (i == 0) return;
        // TODO: seeded random
        let rnd = robertJenkins();
        while (--i) {
            let j = Math.floor(rnd() * (i + 1));
            let tempi = myArray[i];
            let tempj = myArray[j];
            myArray[i] = tempj;
            myArray[j] = tempi;
        }
    }
}