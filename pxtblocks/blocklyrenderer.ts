/// <reference path="./blockly.d.ts" />
/// <reference path="../built/pxtlib.d.ts" />
/// <reference path="../typings/jquery/jquery.d.ts" />

namespace pxt.blocks {
    var workspace: B.Workspace;
    var blocklyDiv:HTMLElement;

    function align(ws: B.Workspace) {
        let blocks = ws.getTopBlocks(true);
        let y = 0
        blocks.forEach(block => {
            block.moveBy(0, y)
            y += block.getHeightWidth().height
            y += 14; //buffer            
        })
    }

    export interface BlocksRenderOptions {
        emPixels?: number;
        align?: boolean;
        clean?: boolean;
    }

    export function render(blocksXml: string, options: BlocksRenderOptions = {}): JQuery {
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
                media: pxt.webConfig.pxtCdnUrl + "blockly/media/"
            });
        }
        
        workspace.clear();
        try {
            let text = blocksXml || "<xml></xml>";
            let xml = Blockly.Xml.textToDom(text);
            Blockly.Xml.domToWorkspace(workspace, xml);

            if (options.align)
                align(workspace);

            if (options.clean && (<any>workspace).cleanUp_)
                (<any>workspace).cleanUp_();

            let metrics = workspace.getMetrics();

            let svg = $(blocklyDiv).find('svg').clone(true, true);
            svg.removeClass("blocklySvg").addClass('blocklyPreview');
            svg.find('.blocklyBlockCanvas,.blocklyBubbleCanvas')
                .attr('transform', `translate(${-metrics.contentLeft}, ${-metrics.contentTop}) scale(1)`)
            svg.find('.blocklyMainBackground').remove();
            svg[0].setAttribute('viewBox', `0 0 ${metrics.contentWidth} ${metrics.contentHeight}`)
            svg.removeAttr('width');
            svg.removeAttr('height');

            if (options.emPixels)
                svg[0].style.width = (metrics.contentWidth / options.emPixels) + 'em';

            return svg;

        } catch (e) {
            console.log(e);
            return undefined;
        }
    }
}