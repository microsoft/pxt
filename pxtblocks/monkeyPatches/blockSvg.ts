import * as Blockly from "blockly";
import { FieldImageNoText } from "../fields/field_imagenotext";
import { ConstantProvider } from "../plugins/renderer/constants";

export function monkeyPatchBlockSvg() {
    const oldSetCollapsed = Blockly.BlockSvg.prototype.setCollapsed;

    Blockly.BlockSvg.prototype.setCollapsed = function (this: Blockly.BlockSvg, collapsed: boolean) {
        if (collapsed === this.isCollapsed()) return;
        oldSetCollapsed.call(this, collapsed);

        if (this.isCollapsed()) {
            const input = this.getInput(Blockly.constants.COLLAPSED_INPUT_NAME);

            const image = ConstantProvider.EXPAND_IMAGE_DATAURI;
            if (image) {
                input.appendField(new FieldImageNoText(image, 24, 24, "", () => {
                    this.setCollapsed(false)
                }, false));
            }
        }
    }
}