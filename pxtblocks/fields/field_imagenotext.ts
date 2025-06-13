
import * as Blockly from "blockly";
import { FieldCustom } from "./field_utils";

/**
 * An image field on the block that does not have a text label.
 * These do not produce text for display strings, but may have a visual element (like an expand button).
 */
export class FieldImageNoText extends Blockly.FieldImage implements FieldCustom {
    isFieldCustom_: boolean = true;

    constructor(src: string | typeof Blockly.Field.SKIP_SETUP, width: string | number, height: string | number, alt?: string, onClick?: (p1: Blockly.FieldImage) => void, flipRtl?: boolean, config?: Blockly.FieldImageConfig) {
        super(src, width, height, alt, onClick, flipRtl, config);
    }

    getFieldDescription(): string {
        return undefined;
    }
}