import * as Blockly from "blockly";
import { PathObject } from "./pathObject";
import { ConstantProvider } from "./constants";
import { BlockStyle } from "blockly/core/theme";
import { RenderInfo } from "./info";
import { Drawer } from "./drawer";

export class Renderer extends Blockly.zelos.Renderer {
    override makePathObject(root: SVGElement, style: BlockStyle): PathObject {
        return new PathObject(root, style, this.getConstants() as ConstantProvider);
    }

    protected override makeConstants_(): ConstantProvider {
        return new ConstantProvider();
    }

    protected override makeRenderInfo_(block: Blockly.BlockSvg): RenderInfo {
        return new RenderInfo(this, block);
    }

    protected override makeDrawer_(
        block: Blockly.BlockSvg,
        info: Blockly.blockRendering.RenderInfo,
    ): Drawer {
        return new Drawer(block, info as RenderInfo);
    }
}

Blockly.blockRendering.register("pxt", Renderer);