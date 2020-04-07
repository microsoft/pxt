/// <reference path="../localtypings/pxtblockly.d.ts" />
/// <reference path="../built/pxtlib.d.ts" />

namespace pxt.blocks {
    let workspace: Blockly.WorkspaceSvg;
    let blocklyDiv: HTMLElement;

    export enum BlockLayout {
        None = 0,
        Align = 1,
        // Shuffle deprecated
        Clean = 3,
        Flow = 4
    }

    export interface BlocksRenderOptions {
        emPixels?: number;
        layout?: BlockLayout;
        clean?: boolean;
        aspectRatio?: number;
        packageId?: string;
        package?: string;
        snippetMode?: boolean;
        useViewWidth?: boolean;
        splitSvg?: boolean;
        forceCompilation?: boolean;
        generateSourceMap?: boolean;
    }

    export function initRenderingWorkspace() {
        if (!workspace) {
            blocklyDiv = document.createElement("div");
            blocklyDiv.style.position = "absolute";
            blocklyDiv.style.top = "0";
            blocklyDiv.style.left = "0";
            blocklyDiv.style.width = "1px";
            blocklyDiv.style.height = "1px";
            document.body.appendChild(blocklyDiv);
            workspace = Blockly.inject(blocklyDiv, {
                move: {
                    scrollbars: false
                },
                readOnly: true,
                sounds: false,
                media: pxt.webConfig.commitCdnUrl + "blockly/media/",
                rtl: Util.isUserLanguageRtl(),
                renderer: "pxt"
            }) as Blockly.WorkspaceSvg;
        }

        pxt.blocks.clearWithoutEvents(workspace);
        return workspace;
    }

    export function cleanRenderingWorkspace() {
        // We re-use the workspace across renders, catch any errors so we know to 
        // create a new workspace if there was an error
        if (workspace) workspace.dispose();
        workspace = undefined;
    }

    export function renderWorkspace(options: BlocksRenderOptions = { emPixels: 18, layout: BlockLayout.Align }): Element {
        const layout = options.splitSvg ? BlockLayout.Align : (options.layout || BlockLayout.Flow);
        switch (layout) {
            case BlockLayout.Align:
                pxt.blocks.layout.verticalAlign(workspace, options.emPixels || 18); break;
            case BlockLayout.Flow:
                pxt.blocks.layout.flow(workspace, { ratio: options.aspectRatio, useViewWidth: options.useViewWidth }); break;
            case BlockLayout.Clean:
                if ((<any>workspace).cleanUp_)
                    (<any>workspace).cleanUp_();
                break;
            default: // do nothing
                break;
        }

        let metrics = workspace.getMetrics() as Blockly.Metrics;

        const svg = blocklyDiv.querySelectorAll('svg')[0].cloneNode(true) as SVGSVGElement;
        pxt.blocks.layout.cleanUpBlocklySvg(svg);

        pxt.U.toArray(svg.querySelectorAll('.blocklyBlockCanvas,.blocklyBubbleCanvas'))
            .forEach(el => el.setAttribute('transform', `translate(${-metrics.contentLeft}, ${-metrics.contentTop}) scale(1)`));

        svg.setAttribute('viewBox', `0 0 ${metrics.contentWidth} ${metrics.contentHeight}`)

        if (options.emPixels) {
            svg.style.width = (metrics.contentWidth / options.emPixels) + 'em';
            svg.style.height = (metrics.contentHeight / options.emPixels) + 'em';
        }

        return options.splitSvg
            ? pxt.blocks.layout.splitSvg(svg, workspace, options.emPixels)
            : svg;
    }

    export function render(blocksXml: string, options: BlocksRenderOptions = { emPixels: 18, layout: BlockLayout.Align }): Element {
        initRenderingWorkspace();
        try {
            let text = blocksXml || `<xml xmlns="http://www.w3.org/1999/xhtml"></xml>`;
            let xml = Blockly.Xml.textToDom(text);
            pxt.blocks.domToWorkspaceNoEvents(xml, workspace);

            return renderWorkspace(options);
        } catch (e) {
            pxt.reportException(e);
            cleanRenderingWorkspace();
            return undefined;
        }
    }

    export function blocksMetrics(ws: Blockly.WorkspaceSvg): { width: number; height: number; } {
        const blocks = ws.getTopBlocks(false);
        if (!blocks.length) return { width: 0, height: 0 };

        let m: { l: number, r: number, t: number, b: number } = undefined;
        blocks.forEach((b: Blockly.BlockSvg) => {
            const r = b.getBoundingRectangle();
            if (!m) m = { l: r.left, r: r.right, t: r.top, b: r.bottom }
            else {
                m.l = Math.min(m.l, r.left);
                m.r = Math.max(m.r, r.right);
                m.t = Math.min(m.t, r.top);
                m.b = Math.min(m.b, r.bottom);
            }
        })

        return {
            width: m.r - m.l,
            height: m.b - m.t
        };
    }
}