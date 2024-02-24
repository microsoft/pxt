/// <reference path="../../localtypings/validatorPlan.d.ts" />

import * as Blockly from "blockly";

export function getNestedChildBlocks(parentBlock: Blockly.Block): Blockly.Block[] {
    // might want the parameter to be true
    // but the fact that false apparently filters out disabled blocks is a huge plus
    const descendants = parentBlock.getDescendants(false);
    console.log("the descendants");
    console.log(descendants);
    const nestedChildren = descendants.filter((block) => block.getSurroundParent() === parentBlock);
    console.log("the nested children");
    console.log(nestedChildren);
    return nestedChildren;
}