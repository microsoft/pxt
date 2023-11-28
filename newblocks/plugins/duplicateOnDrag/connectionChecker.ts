import * as Blockly from "blockly";
import { isDuplicateOnDragBlock } from "./duplicateOnDrag";

export class DuplicateOnDragConnectionChecker extends Blockly.ConnectionChecker {
    doDragChecks(a: Blockly.RenderedConnection, b: Blockly.RenderedConnection, distance: number): boolean {
        if (!super.doDragChecks(a, b, distance)) return false;

        const replacedBlock = b.targetBlock();

        if (replacedBlock && isDuplicateOnDragBlock(replacedBlock)) return false;

        return true;
    }
}