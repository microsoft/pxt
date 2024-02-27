/// <reference path="../../localtypings/validatorPlan.d.ts" />

import * as Blockly from "blockly";

// returns the directly nested children of a block
// for blocks with a mouth, it returns the blocks inside the mouth and its inputs, if any
// for something like pick random, it would return the two number blocks
export function getNestedChildBlocks(parentBlock: Blockly.Block): Blockly.Block[] {
    const descendants = parentBlock.getDescendants(true);
    const nestedChildren = descendants.filter((block) => block.isEnabled() && block.getSurroundParent() === parentBlock);
    return nestedChildren;
}