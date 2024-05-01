/// <reference path="../../localtypings/pxtpackage.d.ts" />
import * as Blockly from "blockly";

// Validates that variables are created and used within the workspace.
// Name is optional. If undefined or empty, all variable names are permitted.
// Returns the definition blocks for variables that passed the check.
export function validateVariableUsage({
    usedBlocks,
    count,
    name,
}: {
    usedBlocks: Blockly.Block[];
    count: number;
    name?: String;
}): {
    passingVarDefinitions: Blockly.Block[];
    passingVarCount: number;
    passed: boolean;
} {
    const varDefinitionBlocks: Map<string, Blockly.Block[]> = new Map();
    const usedVars: Set<string> = new Set(); // Use set so we don't double count vars

    for (const block of usedBlocks) {
        if (!block.isEnabled()) {
            continue;
        }

        const varsUsed = block.getVarModels();
        for (const varModel of varsUsed ?? []) {
            const varName = varModel.name;
            if (!name || varName === name) {
                if (block.type === "variables_set" || block.type === "variables_change") {
                    // Variable created
                    if (!varDefinitionBlocks.has(varName)) {
                        varDefinitionBlocks.set(varName, []);
                    }
                    varDefinitionBlocks.get(varName).push(block);
                } else {
                    // Variable used
                    usedVars.add(varName);
                }
            }
        }
    }

    // Var passes check if it is both used and defined.
    // We return the definition blocks to allow for recursively checking how the var was set.
    // Track passingVarCount separately, since a var could have more than one set block.
    const passingVarDefinitions: Blockly.Block[] = [];
    let passingVarCount = 0;
    for (const varName of usedVars) {
        const varBlocks = varDefinitionBlocks.get(varName) ?? [];
        if (varBlocks.length > 0) {
            passingVarCount++;
            for (const varBlock of varBlocks) {
                passingVarDefinitions.push(varBlock);
            }
        }
    }

    return { passingVarDefinitions, passingVarCount, passed: passingVarCount >= count };
}
