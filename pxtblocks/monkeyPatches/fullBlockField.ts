import * as Blockly from "blockly";
import { assertMethod } from "./util";

/**
 * Blockly only treats a simple reporter as a "full block field" block when its
 * very first field (inputList[0].fieldRow[0]) is itself a full block field. So
 * a reporter with a leading label, e.g. "melody $melody", is never recognised,
 * and is announced as just a value by screen readers with no indication that
 * it's interactive. Contrast "$fraction beat", where the dropdown is first,
 * which works.
 *
 * Workaround until Blockly's getFullBlockField considers fields beyond the first.
 * In future it would be good to include the "melody" and "beat" text in the
 * readout.
 */
export function monkeyPatchFullBlockField() {
    assertMethod(Blockly.BlockSvg.prototype, "getFullBlockField");

    Blockly.BlockSvg.prototype.getFullBlockField = function (this: Blockly.BlockSvg) {
        if (!this.isSimpleReporter()) return null;
        for (const input of this.inputList) {
            for (const field of input.fieldRow) {
                if (field.isFullBlockField()) return field;
            }
        }
        return null;
    };
}
