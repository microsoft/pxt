import * as Blockly from "blockly";
import { PathObject } from "./pathObject";
import { ConstantProvider } from "./constants";
import { BlockStyle } from "blockly/core/theme";

export class Renderer extends Blockly.zelos.Renderer {
    override makePathObject(root: SVGElement, style: BlockStyle): PathObject {
        return new PathObject(root, style, this.getConstants() as ConstantProvider);
    }

    protected override makeConstants_(): ConstantProvider {
        return new ConstantProvider();
    }
}

Blockly.blockRendering.register("pxt", Renderer);