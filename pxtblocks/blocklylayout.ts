
namespace pxt.blocks.layout {

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
        flow(blocks, ratio || 1.62);
    }

    export function screenshot(ws: B.Workspace, name?: string) {
        toPngAsync(ws)
            .done(uri => {
                if (uri)
                    BrowserUtils.browserDownloadDataUri(
                        uri,
                        (name || `${pxt.appTarget.id}-${lf("screenshot")}`) + ".png");
            })
    }

    export function toPngAsync(ws: B.Workspace): Promise<string> {
        let sg = toSvg(ws);
        if (!sg) return Promise.resolve<string>(undefined);

        return new Promise<string>((resolve, reject) => {
            let img = document.createElement("img") as HTMLImageElement;
            img.onload = ev => {
                let cvs = document.createElement("canvas") as HTMLCanvasElement;
                cvs.width = sg.width;
                cvs.height = sg.height;
                let ctx = cvs.getContext("2d");
                ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
                let datauri = cvs.toDataURL("image/png");
                resolve(datauri);
            }
            img.onerror = ev => {
                pxt.reportError("blocks screenshot failed", sg);
                resolve(undefined)
            }
            img.src = "data:image/svg+xml," + encodeURI(sg.xml);
        })
    }

    export function toSvg(ws: B.Workspace): {
        width: number; height: number; xml: string;
    } {
        if (!ws) return undefined;

        const bbox = ws.svgBlockCanvas_.getBBox();
        let sg = ws.svgBlockCanvas_.cloneNode(true) as SVGGElement;
        if (!sg.childNodes[0])
            return undefined;

        const width = bbox.width;
        const height = bbox.height;

        sg.removeAttribute("width");
        sg.removeAttribute("height");
        sg.removeAttribute("transform");
        const customCss = `
.blocklyMainBackground {
    stroke:none !important;
}

.blocklyTreeLabel, .blocklyText, .blocklyHtmlInput {
    font-family:'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace !important;   
}

.blocklyText {    
    font-size:1rem !important;
}

.rtl .blocklyText {
    text-align:right;
}

.blocklyTreeLabel {
    font-size:1.25rem !important;
}

.blocklyCheckbox {
    fill: #ff3030 !important;
    text-shadow: 0px 0px 6px #f00;
    font-size: 17pt !important;
}`;

        let xsg = new DOMParser().parseFromString(
            `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${bbox.x} ${bbox.y} ${width} ${height}">
${new XMLSerializer().serializeToString(sg)}
</svg>`, "image/svg+xml");

        const cssLink = xsg.createElementNS("http://www.w3.org/1999/xhtml", "style");
        // CSS may contain <, > which need to be stored in CDATA section
        cssLink.appendChild(xsg.createCDATASection((Blockly as any).Css.CONTENT.join('') + '\n\n' + customCss + '\n\n'));
        xsg.documentElement.insertBefore(cssLink, xsg.documentElement.firstElementChild);

        let xml = new XMLSerializer().serializeToString(xsg);
        return { width, height, xml };
    }

    function flow(blocks: Blockly.Block[], ratio: number) {
        const gap = 14;
        // compute total block surface and infer width
        let surface = 0;
        for (let block of blocks) {
            let s = block.getHeightWidth();
            surface += s.width * s.height;
        }
        const maxx = Math.sqrt(surface) * ratio;

        let insertx = 0;
        let inserty = 0;
        let endy = 0;
        for (let block of blocks) {
            let r = block.getBoundingRectangle();
            let s = block.getHeightWidth();
            // move block to insertion point
            block.moveBy(insertx - r.topLeft.x, inserty - r.topLeft.y);
            insertx += s.width + gap;
            endy = Math.max(endy, inserty + s.height + gap);
            if (insertx > maxx) { // start new line
                insertx = 0;
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