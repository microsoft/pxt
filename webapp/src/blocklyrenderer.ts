/// <reference path="./blockly.d.ts" />
/// <reference path="../typings/jquery/jquery.d.ts" />

var blocklyDiv = document.createElement("div");
blocklyDiv.style.position = "absolute";
blocklyDiv.style.top = "0";
blocklyDiv.style.left = "0";
blocklyDiv.style.width = "1px";
blocklyDiv.style.height = "1px";

document.body.appendChild(blocklyDiv);
var workspace = Blockly.inject(blocklyDiv, {
    scrollbars: false,
    readOnly: true,
    zoom: false,
    media: (window as any).appCdnRoot + "blockly/media/"
});

export function render(blocksXml: string): JQuery {
    workspace.clear();
    try {
        let text = blocksXml || "<xml></xml>";
        let xml = Blockly.Xml.textToDom(text);
        Blockly.Xml.domToWorkspace(workspace, xml);

        let metrics = workspace.getMetrics();
        
        let svg = $(blocklyDiv).find('svg').clone(true, true);
        svg.removeClass("blocklySvg").addClass('blocklyPreview');
        svg.find('.blocklyBlockCanvas,.blocklyBubbleCanvas')
            .attr('transform', `translate(${-metrics.contentLeft}, ${-metrics.contentTop}) scale(1)`)
        svg.find('.blocklyMainBackground').remove();
        svg[0].setAttribute('viewBox', `0 0 ${metrics.contentWidth} ${metrics.contentHeight}`)
        svg.removeAttr('width');
        svg.removeAttr('height');
        
        return svg;

    } catch (e) { 
        console.log(e); 
        return undefined;
    }
}
