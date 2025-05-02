import * as Blockly from "blockly";
import { MultiFlyoutRecyclableBlockInflater } from "./blockInflater";

export class CachingFlyout extends Blockly.VerticalFlyout {
    clearBlockCache() {
        const inflater = this.getInflaterForType("block");

        if (inflater instanceof MultiFlyoutRecyclableBlockInflater) {
            inflater.clearCache();
        }
    }

    getFlyoutElement(): SVGElement {
        return this.svgGroup_
    }
}