import * as Blockly from "blockly";
import { isAllowlistedShadow, shouldDuplicateOnDrag } from "./duplicateOnDrag";
import { doArgumentReporterDragChecks } from "../functions/utils";
import { FUNCTION_DEFINITION_BLOCK_TYPE } from "../functions/constants";


const OPPOSITE_TYPE: number[] = [];
OPPOSITE_TYPE[Blockly.ConnectionType.INPUT_VALUE] = Blockly.ConnectionType.OUTPUT_VALUE;
OPPOSITE_TYPE[Blockly.ConnectionType.OUTPUT_VALUE] = Blockly.ConnectionType.INPUT_VALUE;
OPPOSITE_TYPE[Blockly.ConnectionType.NEXT_STATEMENT] =
    Blockly.ConnectionType.PREVIOUS_STATEMENT;
OPPOSITE_TYPE[Blockly.ConnectionType.PREVIOUS_STATEMENT] =
    Blockly.ConnectionType.NEXT_STATEMENT;

export class DuplicateOnDragConnectionChecker extends Blockly.ConnectionChecker {
    doDragChecks(a: Blockly.RenderedConnection, b: Blockly.RenderedConnection, distance: number): boolean {
        if (!super.doDragChecks(a, b, distance)) return false;

        const replacedBlock = b.targetBlock();

        if (
            replacedBlock &&
            shouldDuplicateOnDrag(replacedBlock) &&
            !(replacedBlock.isShadow() && isAllowlistedShadow(replacedBlock))
        ) {
            return false;
        }

        if (!doArgumentReporterDragChecks(a, b, distance)) {
            return false;
        }

        const draggedblock = a.sourceBlock_;

        if (draggedblock.type === "function_return") {
            const destinationBlock = b.sourceBlock_;

            if (!destinationBlock.isEnabled()) {
                return true;
            }

            if (b === destinationBlock.outputConnection) {
                return !!getContainingFunction(destinationBlock.getSurroundParent());
            }

            return !!getContainingFunction(destinationBlock);
        }

        return true;
    }

    /**
     * This is the same as the stock connection checker minus the commented out
     * shadow block check
     */
    doSafetyChecks(a: Blockly.Connection | null, b: Blockly.Connection | null): number {
        if (!a || !b) {
            return Blockly.Connection.REASON_TARGET_NULL;
        }
        let superiorBlock;
        let inferiorBlock;
        let superiorConnection;
        let inferiorConnection;
        if (a.isSuperior()) {
            superiorBlock = a.getSourceBlock();
            inferiorBlock = b.getSourceBlock();
            superiorConnection = a;
            inferiorConnection = b;
        } else {
            inferiorBlock = a.getSourceBlock();
            superiorBlock = b.getSourceBlock();
            inferiorConnection = a;
            superiorConnection = b;
        }
        if (superiorBlock === inferiorBlock) {
            return Blockly.Connection.REASON_SELF_CONNECTION;
        } else if (
            inferiorConnection.type !== OPPOSITE_TYPE[superiorConnection.type]
        ) {
            return Blockly.Connection.REASON_WRONG_TYPE;
        } else if (superiorBlock.workspace !== inferiorBlock.workspace) {
            return Blockly.Connection.REASON_DIFFERENT_WORKSPACES;
        // } else if (superiorBlock.isShadow() && !inferiorBlock.isShadow()) {
        //     return Connection.REASON_SHADOW_PARENT;
        } else if (
            inferiorConnection.type === Blockly.ConnectionType.OUTPUT_VALUE &&
            inferiorBlock.previousConnection &&
            inferiorBlock.previousConnection.isConnected()
        ) {
            return Blockly.Connection.REASON_PREVIOUS_AND_OUTPUT;
        } else if (
            inferiorConnection.type === Blockly.ConnectionType.PREVIOUS_STATEMENT &&
            inferiorBlock.outputConnection &&
            inferiorBlock.outputConnection.isConnected()
        ) {
            return Blockly.Connection.REASON_PREVIOUS_AND_OUTPUT;
        }
        return Blockly.Connection.CAN_CONNECT;
    }
}

export function getContainingFunction(block: Blockly.Block) {
    let parent = block;

    while (parent) {
        if (parent.type === ts.pxtc.ON_START_TYPE) {
            return undefined;
        }

        if (parent.inputList.some(input => input.type === Blockly.inputs.inputTypes.STATEMENT)) {
            if (parent.type === FUNCTION_DEFINITION_BLOCK_TYPE) {
                return parent;
            }

            // getBlockDefintion will return a definition for all builtin blocks including loops
            // and if/else. if there isn't a definition, this must be user defined and thus a
            // function that can be returned from
            if (!pxt.blocks.getBlockDefinition(parent.type)) {
                return parent;
            }
        }

        parent = parent.getSurroundParent();
    }

    return undefined;
}