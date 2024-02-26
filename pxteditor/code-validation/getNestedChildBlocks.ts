/// <reference path="../../localtypings/validatorPlan.d.ts" />

import * as Blockly from "blockly";

export function getNestedChildBlocks(parentBlock: Blockly.Block): Blockly.Block[] {
    // want param to be false to filter out disabled blocks
    const descendants = parentBlock.getDescendants(false);
    const nestedChildren = descendants.filter((block) => block.getSurroundParent() === parentBlock);
    return nestedChildren;
}