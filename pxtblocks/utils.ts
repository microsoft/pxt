import * as Blockly from "blockly";
import { FieldImageNoText } from "./fields/field_imagenotext";

// Moves focus to the given node, but only when focus currently sits on one of
// our FieldImageNoText buttons (the +/-/expand/collapse icons) or nowhere. This
// keeps focus sensible after such a button re-renders away the element that had
// focus, without stealing focus if it has moved elsewhere.
export const maybeMoveFocusFromButton = (node: Blockly.IFocusableNode | undefined): void => {
    const focusManager = Blockly.getFocusManager();
    const currentlyFocusedNode = focusManager.getFocusedNode();
    if (
        node &&
        (currentlyFocusedNode instanceof FieldImageNoText || !currentlyFocusedNode)
    ) {
        focusManager.focusNode(node);
    }
}
