import * as Blockly from "blockly";

// validates that one or more blocks comments are in the project
// returns the blocks that have comments for teacher tool scenario
export function validateBlockFieldValueExists({ usedBlocks, fieldType, fieldValue, specifiedBlock }: {
    usedBlocks: Blockly.Block[],
    fieldType: string,
    fieldValue: string,
    specifiedBlock: string,
}): {
    successfulBlocks: Blockly.Block[],
    passed: boolean
} {
    const enabledSpecifiedBlocks = usedBlocks.filter((block) =>
        block.isEnabled() && block.type === specifiedBlock
    );

    const successfulBlocks = enabledSpecifiedBlocks.filter((block) => {
        if (fieldType === "VAR") {
            return block.getVarModels()?.[0].getName() === fieldValue;
        } else {
            return block.getFieldValue(fieldType) === fieldValue;
        }
    }
    );

    return { successfulBlocks, passed: successfulBlocks.length > 0 };
}