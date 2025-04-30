import * as Blockly from "blockly";
import { FieldCustom } from "./fields/field_utils";

export function getBlockText(block: Blockly.BlockSvg): string {
  const fieldValues = [];
  for (const input of block.inputList) {
    if (!input.isVisible()) {
      continue;
    }

    if (input.fieldRow.length > 0) {
      for (const field of input.fieldRow) {
        if (!field.isVisible()) {
          continue;
        }

        const text = (field as FieldCustom & Blockly.Field).isFieldCustom_
          ? (field as any).getFieldDescription()
          : field.getText();

        if (text) {
          fieldValues.push(text);
        }
      }

      // Check if this input has a connected block
      if (input.connection && input.connection.targetBlock()) {
        const connectedBlock = input.connection.targetBlock();
        const innerBlockText = getBlockText(connectedBlock as Blockly.BlockSvg);
        if (innerBlockText) {
          fieldValues.push(`[${innerBlockText}]`);
        }
      }
    }
  }
  return fieldValues.join(" ");
}
