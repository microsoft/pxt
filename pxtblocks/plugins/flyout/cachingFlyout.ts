import * as Blockly from "blockly";
import { MultiFlyoutRecyclableBlockInflater } from "./blockInflater";

export class CachingFlyout extends Blockly.VerticalFlyout {
    forceOpen: boolean = false;

    clearBlockCache() {
        const inflater = this.getInflaterForType("block");

        if (inflater instanceof MultiFlyoutRecyclableBlockInflater) {
            inflater.clearCache();
        }
    }

    getFlyoutElement(): SVGElement {
        return this.svgGroup_
    }

    setForceOpen(forceOpen: boolean): void {
        this.forceOpen = forceOpen;
    }
}