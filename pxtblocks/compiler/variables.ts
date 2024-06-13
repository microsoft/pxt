/// <reference path="../../built/pxtlib.d.ts" />


import * as Blockly from "blockly";

import { Scope, Environment, BlockDeclarationType, VarInfo, GrayBlockStatement } from "./environment";
import { getDeclaredVariables, mkPoint } from "./typeChecker";
import { forEachChildExpression, forEachStatementInput } from "./util";


export function trackAllVariables(topBlocks: Blockly.Block[], e: Environment) {
    let id = 1;
    let topScope: Scope;

    // First, look for on-start
    topBlocks.forEach(block => {
        if (block.type === ts.pxtc.ON_START_TYPE) {
            const firstStatement = block.getInputTargetBlock("HANDLER");
            if (firstStatement) {
                topScope = {
                    firstStatement: firstStatement,
                    declaredVars: {},
                    referencedVars: [],
                    children: [],
                    assignedVars: []
                }
                trackVariables(firstStatement, topScope, e);
            }
        }
    });

    // If we didn't find on-start, then create an empty top scope
    if (!topScope) {
        topScope = {
            firstStatement: null,
            declaredVars: {},
            referencedVars: [],
            children: [],
            assignedVars: []
        }
    }

    topBlocks.forEach(block => {
        if (block.type === ts.pxtc.ON_START_TYPE) {
            return;
        }
        trackVariables(block, topScope, e);
    });

    Object.keys(topScope.declaredVars).forEach(varName => {
        const varID = topScope.declaredVars[varName];
        delete topScope.declaredVars[varName];
        const declaringScope = findCommonScope(topScope, varID.id) || topScope;
        declaringScope.declaredVars[varName] = varID;
    })

    markDeclarationLocations(topScope, e);
    escapeVariables(topScope, e);

    return topScope;

    function trackVariables(block: Blockly.Block, currentScope: Scope, e: Environment) {
        e.idToScope[block.id] = currentScope;

        if (block.type === "variables_get") {
            const name = block.getField("VAR").getText();
            const info = findOrDeclareVariable(name, currentScope);
            currentScope.referencedVars.push(info.id);
        }
        else if (block.type === "variables_set" || block.type === "variables_change") {
            const name = block.getField("VAR").getText();
            const info = findOrDeclareVariable(name, currentScope);
            currentScope.assignedVars.push(info.id);
            currentScope.referencedVars.push(info.id);
        }
        else if (block.type === pxtc.TS_STATEMENT_TYPE) {
            const declaredVars: string = (block as GrayBlockStatement).declaredVariables
            if (declaredVars) {
                const varNames = declaredVars.split(",");
                varNames.forEach(vName => {
                    const info = findOrDeclareVariable(vName, currentScope);
                    info.alreadyDeclared = BlockDeclarationType.Argument;
                });
            }
        }

        if (hasStatementInput(block)) {
            const vars: VarInfo[] = getDeclaredVariables(block, e).map(binding => {
                return {
                    ...binding,
                    id: id++
                }
            });


            let parentScope = currentScope;
            if (vars.length) {
                // We need to create a scope for this block, and then a scope
                // for each statement input (in case there are multiple)

                parentScope = {
                    parent: currentScope,
                    firstStatement: block,
                    declaredVars: {},
                    referencedVars: [],
                    assignedVars: [],
                    children: []
                };

                vars.forEach(v => {
                    v.alreadyDeclared = BlockDeclarationType.Assigned;
                    parentScope.declaredVars[v.name] = v;
                });

                e.idToScope[block.id] = parentScope;
            }


            if (currentScope !== parentScope) {
                currentScope.children.push(parentScope);
            }

            forEachChildExpression(block, child => {
                trackVariables(child, parentScope, e);
            });

            forEachStatementInput(block, connectedBlock => {
                const newScope: Scope = {
                    parent: parentScope,
                    firstStatement: connectedBlock,
                    declaredVars: {},
                    referencedVars: [],
                    assignedVars: [],
                    children: []
                };
                parentScope.children.push(newScope);
                trackVariables(connectedBlock, newScope, e);
            });
        }
        else {
            forEachChildExpression(block, child => {
                trackVariables(child, currentScope, e);
            });
        }

        if (block.nextConnection && block.nextConnection.targetBlock()) {
            trackVariables(block.nextConnection.targetBlock(), currentScope, e);
        }
    }

    function findOrDeclareVariable(name: string, scope: Scope): VarInfo {
        if (scope.declaredVars[name]) {
            return scope.declaredVars[name];
        }
        else if (scope.parent) {
            return findOrDeclareVariable(name, scope.parent);
        }
        else {
            // Declare it in the top scope
            scope.declaredVars[name] = {
                name,
                type: mkPoint(null),
                id: id++
            };
            return scope.declaredVars[name];
        }
    }
}

function markDeclarationLocations(scope: Scope, e: Environment) {
    const declared = Object.keys(scope.declaredVars);
    if (declared.length) {
        const decls = declared.map(name => scope.declaredVars[name]);

        if (scope.firstStatement) {
            // If we can't find a better place to declare the variable, we'll declare
            // it before the first statement in the code block so we need to keep
            // track of the blocks ids
            e.blockDeclarations[scope.firstStatement.id] = decls.concat(e.blockDeclarations[scope.firstStatement.id] || []);
        }

        decls.forEach(d => e.allVariables.push(d));
    }

    scope.children.forEach(child => markDeclarationLocations(child, e));
}

function findCommonScope(current: Scope, varID: number): Scope {
    let ref: Scope;

    if (current.referencedVars.indexOf(varID) !== -1) {
        return current;
    }

    for (const child of current.children) {
        if (referencedWithinScope(child, varID)) {
            if (assignedWithinScope(child, varID)) {
                return current;
            }
            if (!ref) {
                ref = child;
            }
            else {
                return current;
            }
        }
    }

    return ref ? findCommonScope(ref, varID) : undefined;
}

function referencedWithinScope(scope: Scope, varID: number) {
    if (scope.referencedVars.indexOf(varID) !== -1) {
        return true;
    }
    else {
        for (const child of scope.children) {
            if (referencedWithinScope(child, varID)) return true;
        }
    }
    return false;
}

function assignedWithinScope(scope: Scope, varID: number) {
    if (scope.assignedVars.indexOf(varID) !== -1) {
        return true;
    }
    else {
        for (const child of scope.children) {
            if (assignedWithinScope(child, varID)) return true;
        }
    }
    return false;
}

function escapeVariables(current: Scope, e: Environment) {
    for (const varName of Object.keys(current.declaredVars)) {
        const info = current.declaredVars[varName];
        if (!info.escapedName) info.escapedName = escapeVarName(varName);
    }

    current.children.forEach(c => escapeVariables(c, e));


    function escapeVarName(originalName: string): string {
        if (!originalName) return '_';

        let n = ts.pxtc.escapeIdentifier(originalName);

        if (e.renames.takenNames[n] || nameIsTaken(n, current, originalName)) {
            let i = 2;

            while (e.renames.takenNames[n + i] || nameIsTaken(n + i, current, originalName)) {
                i++;
            }

            n += i;
        }

        return n;
    }

    function nameIsTaken(name: string, scope: Scope, originalName: string): boolean {
        if (scope) {
            for (const varName of Object.keys(scope.declaredVars)) {
                const info = scope.declaredVars[varName];
                if ((originalName !== info.name || info.name !== info.escapedName) && info.escapedName === name)
                    return true;
            }
            return nameIsTaken(name, scope.parent, originalName);
        }

        return false;
    }
}

function hasStatementInput(block: Blockly.Block) {
    return block.inputList.some(i => i.type === Blockly.inputs.inputTypes.STATEMENT);
}