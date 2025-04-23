import * as Blockly from "blockly";

export function getBlockText(block: Blockly.BlockSvg): string {
  const fieldValues = [];
  for (const input of block.inputList) {
    if (input.fieldRow.length > 0) {
      for (const field of input.fieldRow) {
        const text = field.getText();
        if (text) {
          fieldValues.push(text);
        }
      }
    }
  }
  return fieldValues.join(" ");
}
