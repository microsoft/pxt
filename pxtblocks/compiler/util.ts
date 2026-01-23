import * as Blockly from "blockly";
import { Environment, Scope, StdFunc } from "./environment";
import { MutatingBlock } from "../legacyMutations";


export function forEachChildExpression(block: Blockly.Block, cb: (block: Blockly.Block) => void, recursive = false) {
    block.inputList.filter(i => i.type === Blockly.inputs.inputTypes.VALUE).forEach(i => {
        if (i.connection && i.connection.targetBlock()) {
            cb(i.connection.targetBlock());
            if (recursive) {
                forEachChildExpression(i.connection.targetBlock(), cb, recursive);
            }
        }
    });
}

export function forEachStatementInput(block: Blockly.Block, cb: (block: Blockly.Block) => void) {
    block.inputList.filter(i => i.type === Blockly.inputs.inputTypes.STATEMENT).forEach(i => {
        if (i.connection && i.connection.targetBlock()) {
            cb(i.connection.targetBlock());
        }
    })
}

export function printScope(scope: Scope, depth = 0) {
    const declared = Object.keys(scope.declaredVars).map(k => `${k}(${scope.declaredVars[k].id})`).join(",");
    const referenced = scope.referencedVars.join(", ");
    console.log(`${mkIndent(depth)}SCOPE: ${scope.firstStatement ? scope.firstStatement.type : "TOP-LEVEL"}`)
    if (declared.length) {
        console.log(`${mkIndent(depth)}DECS: ${declared}`)
    }
    // console.log(`${mkIndent(depth)}REFS: ${referenced}`)
    scope.children.forEach(s => printScope(s, depth + 1));
}

function mkIndent(depth: number) {
    let res = "";
    for (let i = 0; i < depth; i++) {
        res += "    ";
    }
    return res;
}

export function getLoopVariableField(e: Environment, b: Blockly.Block) {
    return (b.type == "pxt_controls_for" || b.type == "pxt_controls_for_of") ?
        getInputTargetBlock(e, b, "VAR") : b;
}

export function getFunctionName(functionBlock: Blockly.Block) {
    return functionBlock.getField("function_name").getText();
}

export function visibleParams({ comp }: StdFunc, optionalCount: number) {
    const res: pxt.blocks.BlockParameter[] = [];
    if (comp.thisParameter) {
        res.push(comp.thisParameter);
    }

    comp.parameters.forEach(p => {
        if (p.isOptional && optionalCount > 0) {
            res.push(p);
            --optionalCount;
        }
        else if (!p.isOptional) {
            res.push(p);
        }
    });

    return res;
}

export function countOptionals(b: Blockly.Block, func: StdFunc) {
    if (func.attrs.compileHiddenArguments) {
        return func.comp.parameters.reduce((prev, block) => {
            if (block.isOptional) prev++;
            return prev
        }, 0);
    }
    if ((b as MutatingBlock).mutationToDom) {
        const el = (b as MutatingBlock).mutationToDom();
        if (el.hasAttribute("_expanded")) {
            const val = parseInt(el.getAttribute("_expanded"));
            return isNaN(val) ? 0 : Math.max(val, 0);
        }
    }
    return 0;
}

export function getInputTargetBlock(e: Environment, b: Blockly.Block, n: string): Blockly.Block {
    const res = b.getInputTargetBlock(n);

    if (!res) {
        return e.placeholders[b.id]?.[n];
    }
    else {
        return res
    }
}

export function isMutatingBlock(b: Blockly.Block): b is MutatingBlock {
    return !!(b as MutatingBlock).mutation;
}

// convert to javascript friendly name
export function escapeVarName(name: string, e: Environment, isFunction = false): string {
    if (!name) return '_';

    if (isFunction) {
        if (e.renames.oldToNewFunctions[name]) {
            return e.renames.oldToNewFunctions[name];
        }
    }
    else if (e.renames.oldToNew[name]) {
        return e.renames.oldToNew[name];
    }

    let n = ts.pxtc.escapeIdentifier(name);

    if (e.renames.takenNames[n]) {
        let i = 2;

        while (e.renames.takenNames[n + i]) {
            i++;
        }

        n += i;
    }

    if (isFunction) {
        e.renames.oldToNewFunctions[name] = n;
        e.renames.takenNames[n] = true;
    }
    else {
        e.renames.oldToNew[name] = n;
    }
    return n;
}

export function append<T>(a1: T[], a2: T[]) {
    a1.push.apply(a1, a2);
}

export function isFunctionDefinition(b: Blockly.Block) {
    return b.type === "procedures_defnoreturn" || b.type === "function_definition";
}