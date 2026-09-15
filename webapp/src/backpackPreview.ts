import * as Blockly from "blockly";
import * as pxtblockly from "../../pxtblocks";
import { MAX_BACKPACK_PREVIEW_LENGTH } from "./backpack";

/** Rasterize a detached copy: previews must not deserialize assets or mutate the source workspace. */
export async function backpackPreviewAsync(block: Blockly.BlockSvg): Promise<string | undefined> {
    const source = block.getSvgRoot();
    if (!source) return undefined;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    try {
        const copy = source.cloneNode(true) as SVGGElement;
        const next = block.getNextBlock()?.getSvgRoot();
        const nextIndex = next ? Array.from(source.children).indexOf(next) : -1;
        if (nextIndex >= 0) copy.children[nextIndex].remove();
        copy.removeAttribute("transform");
        svg.appendChild(copy);
        pxtblockly.cleanUpBlocklySvg(svg, block.workspace.getParentSvg());
        // Measure the copy without exposing it to interaction or screen readers.
        svg.setAttribute("aria-hidden", "true");
        svg.style.cssText = "position:fixed;left:-10000px;top:0;opacity:0;pointer-events:none";
        document.body.appendChild(svg);
        const bounds = copy.getBBox();
        if (!bounds.width || !bounds.height) return undefined;
        svg.removeAttribute("style");
        svg.remove();
        const scale = Math.min(1, 320 / bounds.width, 160 / bounds.height);
        const rendered = await pxtblockly.blocklyToSvgAsync(svg, bounds.x - 1, bounds.y - 1, bounds.width + 2, bounds.height + 2, scale);
        if (!rendered) return undefined;
        const image = await pxt.BrowserUtils.encodeToPngAsync(rendered.xml, { width: rendered.width, height: rendered.height, pixelDensity: 1 });
        return image?.length <= MAX_BACKPACK_PREVIEW_LENGTH ? image : undefined;
    } catch {
        // The actual code remains usable when canvas rendering or optional thumbnail capture fails.
        return undefined;
    } finally {
        svg.remove();
    }
}