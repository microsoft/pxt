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
    passingVarDefinitions: Map<string, Blockly.Block[]>;
    passed: boolean;
} {
    const varDefinitionBlocks: Map<string, Blockly.Block[]> = new Map();
    const usedVars: Set<string> = new Set();

    for (const block of usedBlocks) {
        if (!block.isEnabled()) {
            continue;
        }

        const varsUsed = block.getVarModels();
        for (const varModel of varsUsed ?? []) {
            const varName = varModel.getName();
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
    const passingVarDefinitions = new Map<string, Blockly.Block[]>();
    for (const [varName, definitionBlocks] of varDefinitionBlocks) {
        if (usedVars.has(varName)) {
            passingVarDefinitions.set(varName, definitionBlocks);
        }
    }

    return { passingVarDefinitions, passed: passingVarDefinitions.size >= count };
}
