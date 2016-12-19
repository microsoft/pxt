/// <reference path="../built/blockly.d.ts" />
/// <reference path="../built/pxtlib.d.ts" />
/// <reference path="../typings/jquery/jquery.d.ts" />

namespace pxt.blocks {
    let workspace: B.Workspace;
    let blocklyDiv: HTMLElement;

    function align(ws: B.Workspace, emPixels: number) {
        let blocks = ws.getTopBlocks(true);
        let y = 0
        blocks.forEach(block => {
            block.moveBy(0, y)
            y += block.getHeightWidth().height
            y += emPixels; //buffer
        })
    }

    export enum BlockLayout {
        Align = 1,
        Shuffle = 2,
        Clean = 3,
        Flow = 4
    }

    export interface BlocksRenderOptions {
        emPixels?: number;
        layout?: BlockLayout;
        clean?: boolean;
        aspectRatio?: number;
        package?: string;
        snippetMode?: boolean;
    }

    export function render(blocksXml: string, options: BlocksRenderOptions = { emPixels: 14, layout: BlockLayout.Flow }): HTMLElement {
        if (!workspace) {
            blocklyDiv = document.createElement("div");
            blocklyDiv.style.position = "absolute";
            blocklyDiv.style.top = "0";
            blocklyDiv.style.left = "0";
            blocklyDiv.style.width = "1px";
            blocklyDiv.style.height = "1px";
            document.body.appendChild(blocklyDiv);
            workspace = Blockly.inject(blocklyDiv, {
                scrollbars: false,
                readOnly: true,
                zoom: false,
                sound: false,
                media: pxt.webConfig.pxtCdnUrl + "blockly/media/",
                rtl: Util.userLanguageRtl()
            });
        }

        workspace.clear();
        try {
            let text = blocksXml || `<xml xmlns="http://www.w3.org/1999/xhtml"></xml>`;
            let xml = Blockly.Xml.textToDom(text);
            Blockly.Xml.domToWorkspace(xml, workspace);

            switch (options.layout) {
                case BlockLayout.Align:
                    pxt.blocks.layout.verticalAlign(workspace, options.emPixels); break;
                case BlockLayout.Shuffle:
                    pxt.blocks.layout.shuffle(workspace, options.aspectRatio); break;
                case BlockLayout.Flow:
                    pxt.blocks.layout.flow(workspace, options.aspectRatio); break;
                case BlockLayout.Clean:
                    if ((<any>workspace).cleanUp_)
                        (<any>workspace).cleanUp_();
                    break;
            }


            let metrics = workspace.getMetrics();

            let svg = $(blocklyDiv).find('svg').clone(true, true);
            svg.removeClass("blocklySvg").addClass('blocklyPreview');
            svg.find('.blocklyBlockCanvas,.blocklyBubbleCanvas')
                .attr('transform', `translate(${-metrics.contentLeft}, ${-metrics.contentTop}) scale(1)`)
            svg.find('.blocklyMainBackground').remove();
            svg[0].setAttribute('viewBox', `0 0 ${metrics.contentWidth} ${metrics.contentHeight}`)
            svg.removeAttr('width');
            svg.removeAttr('height');

            if (options.emPixels) {
                svg[0].style.width = (metrics.contentWidth / options.emPixels) + 'em';
                svg[0].style.height = (metrics.contentHeight / options.emPixels) + 'em';
            }

            return svg[0];

        } catch (e) {
            pxt.reportException(e);
            return undefined;
        }
    }

    export function blocksMetrics(ws: Blockly.Workspace): { width: number; height: number; } {
        const blocks = ws.getTopBlocks(false);
        if (!blocks.length) return { width: 0, height: 0 };

        let m: { l: number, r: number, t: number, b: number } = undefined;
        blocks.forEach(b => {
            const r = b.getBoundingRectangle();
            if (!m) m = { l: r.topLeft.x, r: r.bottomRight.x, t: r.topLeft.y, b: r.bottomRight.y }
            else {
                m.l = Math.min(m.l, r.topLeft.x);
                m.r = Math.max(m.r, r.bottomRight.y);
                m.t = Math.min(m.t, r.topLeft.y);
                m.b = Math.min(m.b, r.bottomRight.y);
            }
        })

        return {
            width: m.r - m.l,
            height: m.b - m.t
        };
    }
}