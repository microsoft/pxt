import * as Blockly from "blockly";
import { FieldImageNoText } from "./fields/field_imagenotext";

export const maybeFocusMutatorButton = (node: Blockly.IFocusableNode | undefined): void => {
    const focusManager = Blockly.getFocusManager();
    const currentlyFocusedNode = focusManager.getFocusedNode();
    if (
        node &&
        (currentlyFocusedNode instanceof FieldImageNoText || !currentlyFocusedNode)
    ) {
        focusManager.focusNode(node);
    }
}