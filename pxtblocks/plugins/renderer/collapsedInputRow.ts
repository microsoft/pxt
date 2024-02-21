import * as Blockly from "blockly";
import { ConstantProvider } from "./constants";

export class CollapsedInputRow extends Blockly.blockRendering.InputRow {
    constructor(constants: ConstantProvider) {
        super(constants);
        this.type |= Blockly.blockRendering.Types.INPUT_ROW | Blockly.blockRendering.Types.getType("COLLAPSED_INPUT_ROW");
    }

    measure(): void {
        this.width = this.minWidth;
        this.height = this.constants_.EMPTY_STATEMENT_INPUT_HEIGHT;
    }
}

export function isCollapsedInputRow(row: Blockly.blockRendering.Row): row is CollapsedInputRow {
    return !!(row.type & Blockly.blockRendering.Types.getType("COLLAPSED_INPUT_ROW"));
}