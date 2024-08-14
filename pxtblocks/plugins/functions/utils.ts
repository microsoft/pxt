import * as Blockly from "blockly";
import { CommonFunctionBlock } from "./commonFunctionMixin";
import {
    ARGUMENT_EDITOR_CUSTOM_BLOCK_TYPE,
    ARGUMENT_REPORTER_ARRAY_BLOCK_TYPE,
    ARGUMENT_REPORTER_BOOLEAN_BLOCK_TYPE,
    ARGUMENT_REPORTER_CUSTOM_BLOCK_TYPE,
    ARGUMENT_REPORTER_NUMBER_BLOCK_TYPE,
    ARGUMENT_REPORTER_STRING_BLOCK_TYPE,
    FUNCTION_CALL_BLOCK_TYPE,
    FUNCTION_CALL_OUTPUT_BLOCK_TYPE,
    FUNCTION_DEFINITION_BLOCK_TYPE,
} from "./constants";
import { FunctionManager } from "./functionManager";
import { MsgKey } from "./msg";
import { newFunctionMutation } from "./blocks/functionDeclarationBlock";
import { FunctionDefinitionBlock } from "./blocks/functionDefinitionBlock";
import { ArgumentReporterBlock } from "./blocks/argumentReporterBlocks";

export type StringMap<T> = { [index: string]: T };

export function rename(this: Blockly.FieldTextInput, name: string) {
    // Strip leading and trailing whitespace. Beyond this, all names are legal.
    name = name.replace(/^[\s\xa0]+|[\s\xa0]+$/g, "");
    const sourceBlock = this.sourceBlock_ as CommonFunctionBlock;

    const legalName = findLegalName(name, sourceBlock.workspace, sourceBlock);
    const oldName = this.getValue();

    if (!name) return oldName;
    else if (!legalName) return name;

    // For newly crecated functions (value not set yet), use legal name and save on block
    if (!oldName) {
        sourceBlock.name_ = legalName;
        return legalName;
    }

    if (oldName != name && oldName != legalName) {
        // Temporarily change the function name to the new name so we can generate the new mutation,
        // but reset to the old name afterwards so that mutateCallersAndDefinition() can find the
        // function by its old name.
        sourceBlock.name_ = legalName;
        const newMutation = sourceBlock.mutationToDom();
        sourceBlock.name_ = oldName;
        mutateCallersAndDefinition(oldName, sourceBlock.workspace, newMutation);
    }

    return legalName;
}

export function getDefinition(name: string, workspace: Blockly.Workspace) {
    // Assume that a function definition is a top block.
    for (const block of workspace.getTopBlocks(false)) {
        if (block.type === FUNCTION_DEFINITION_BLOCK_TYPE) {
            const cBlock = block as CommonFunctionBlock;

            if (cBlock.getName() === name) {
                return cBlock;
            }
        }
    }

    return null;
}

function getCallers(name: string, workspace: Blockly.Workspace) {
    const callers = [];
    // Iterate through every block and check the name.
    for (const block of workspace.getAllBlocks(false)) {
        // TODO: Ideally this should only check for function calls, but changing the if condition
        // causes a bug in mutateCallersAndDefinition() where arg reporters are deleted from the
        // function definition. The reason it works right now from what I've gathered is that the
        // function definition gets included twice in mutateCallersAndDefinition(): once from this call
        // (because it does not filter on function calls, so it also incldues the function definition),
        // and once from mutateCallersAndDefinition() that hardcodes adding the definition to the array
        // of blocks to mutate. So, the definition gets processed twice: the 1st time, the arg
        // reporters get deleted from the definition; but the second time, the mutationToDom() fixes
        // the deleted arg reporters and returns early (because the mutation hasn't changed between the
        // first pass and the 2nd pass). Uncommenting the below if() makes it so the definition is only
        // processed once, so the arg reporters are deleted and never fixed by the 2nd pass.
        if (block.type === FUNCTION_CALL_BLOCK_TYPE || block.type === FUNCTION_CALL_OUTPUT_BLOCK_TYPE) {
            const cBlock = block as CommonFunctionBlock;

            if (cBlock.getName() === name) {
                callers.push(cBlock);
            }
        }
    }

    return callers;
}

export function getAllFunctionDefinitionBlocks(workspace: Blockly.Workspace) {
    // Assume that a function definition is a top block.
    return workspace
        .getTopBlocks(false)
        .filter((b) => b.type === FUNCTION_DEFINITION_BLOCK_TYPE) as CommonFunctionBlock[];
}

export function isCustomType(argumentType: string) {
    return !(argumentType == "boolean" || argumentType == "string" || argumentType == "number");
}

export function createCustomArgumentReporter(typeName: string, ws: Blockly.Workspace) {
    return createCustomArgumentBlock(ARGUMENT_REPORTER_CUSTOM_BLOCK_TYPE, typeName, ws);
}

export function createCustomArgumentEditor(typeName: string, ws: Blockly.Workspace) {
    return createCustomArgumentBlock(ARGUMENT_EDITOR_CUSTOM_BLOCK_TYPE, typeName, ws);
}

function createCustomArgumentBlock(blockType: string, typeName: string, ws: Blockly.Workspace) {
    const block = Blockly.utils.xml.createElement("block");
    block.setAttribute("type", blockType);

    const mutation = Blockly.utils.xml.createElement("mutation");
    mutation.setAttribute("typename", typeName);

    block.appendChild(mutation);

    return Blockly.Xml.domToBlock(block, ws);
}

export function findLegalName(name: string, ws: Blockly.Workspace, block?: CommonFunctionBlock) {
    if (block?.isInFlyout) {
        // Flyouts can have multiple procedures called 'do something'.
        return name;
    }

    const usedNames = namesInUse(ws, block);

    while (usedNames[name]) {
        name = incrementNameSuffix(name);
    }

    return name;
}

function namesInUse(ws: Blockly.Workspace, exceptBlock?: Blockly.Block, exceptFuncId?: string) {
    const usedNames: StringMap<boolean> = {};
    ws.getAllVariables().forEach(function (v) {
        usedNames[v.name] = true;
    });
    ws.getAllBlocks(false).forEach(function (b) {
        const block = b as CommonFunctionBlock;

        if (block == exceptBlock || (!!exceptFuncId && block.getFunctionId && block.getFunctionId() == exceptFuncId)) {
            return;
        }

        if (block.type == FUNCTION_DEFINITION_BLOCK_TYPE) {
            usedNames[block.getName()] = true;
        } else if (b.type == "procedures_defreturn" || b.type == "procedures_defnoreturn") {
            // FIXME: do we even ned this?
            // usedNames[(b as Blockly.Procedures.IProcedureBlock).getProcedureDef()[0]] = true;
        }
    });
    return usedNames;
}

export function idsInUse(ws: Blockly.Workspace) {
    const ids: string[] = [];
    ws.getAllBlocks(false).forEach(function (b) {
        if (b.type == FUNCTION_DEFINITION_BLOCK_TYPE) {
            ids.push((b as CommonFunctionBlock).getFunctionId());
        }
    });
    return ids;
}

function incrementNameSuffix(name: string) {
    const r = name.match(/^(.*?)(\d+)$/);
    if (!r) {
        name += "2";
    } else {
        name = r[1] + (parseInt(r[2], 10) + 1);
    }
    return name;
}

export function mutateCallersAndDefinition(name: string, ws: Blockly.Workspace, mutation: Element) {
    const definitionBlock = getDefinition(name, ws);
    if (definitionBlock) {
        const callers = getCallers(name, definitionBlock.workspace);
        callers.push(definitionBlock);
        Blockly.Events.setGroup(true);
        callers.forEach(function (caller) {
            const oldMutationDom = caller.mutationToDom();
            const oldMutation = oldMutationDom && Blockly.Xml.domToText(oldMutationDom);
            caller.domToMutation(mutation);
            const newMutationDom = caller.mutationToDom();
            const newMutation = newMutationDom && Blockly.Xml.domToText(newMutationDom);

            if (oldMutation != newMutation) {
                // Fire a mutation event to force the block to update.
                Blockly.Events.fire(new Blockly.Events.BlockChange(caller, "mutation", null, oldMutation, newMutation));

                // For the definition, we also need to update all arguments that are
                // used inside the function.
                if (caller.id == definitionBlock.id) {
                    // First, build a map of oldArgName -> argId from the old mutation,
                    // and a map of argId -> newArgName from the new mutation.
                    const oldArgNamesToIds = getArgMap(oldMutationDom, false);
                    const idsToNewArgNames = getArgMap(newMutationDom, true);

                    // Then, go through all descendants of the function definition and
                    // look for argument reporters to update.
                    definitionBlock.getDescendants(false).forEach(function (d) {
                        if (!isFunctionArgumentReporter(d)) {
                            return;
                        }

                        // Find the argument ID corresponding to this old argument name.
                        let argName = d.getFieldValue("VALUE");
                        let argId = oldArgNamesToIds[argName];

                        // This argument reporter must belong to a different block. For example,
                        // a block with handlerStatement=1 and draggableParameters=reporter
                        if (argId === undefined) {
                            return;
                        }

                        if (!idsToNewArgNames[argId]) {
                            // That arg ID no longer exists on the new mutation, delete this
                            // arg reporter.
                            d.dispose(true);
                        } else if (idsToNewArgNames[argId] !== argName) {
                            // That arg ID still exists, but the name was changed, so update
                            // this reporter's display text.
                            d.setFieldValue(idsToNewArgNames[argId], "VALUE");
                        }
                    });
                } else {
                    // For the callers, we need to bump blocks that were connected to any
                    // argument that has since been deleted.
                    setTimeout(function () {
                        caller.bumpNeighbours();
                    }, Blockly.config.bumpDelay);
                }
            }
        });
        Blockly.Events.setGroup(false);
    } else {
        console.warn("Attempted to change function " + name + ", but no definition block was found on the workspace");
    }
}

function getArgMap(mutation: Element, inverse: boolean) {
    const map: StringMap<string> = {};
    for (let i = 0; i < mutation.childNodes.length; ++i) {
        const arg = mutation.childNodes[i] as Element;
        const key = inverse ? arg.getAttribute("id") : arg.getAttribute("name");
        const val = inverse ? arg.getAttribute("name") : arg.getAttribute("id");
        map[key!] = val!;
    }
    return map;
}

function isFunctionArgumentReporter(block: Blockly.Block) {
    return (
        block.type == ARGUMENT_REPORTER_BOOLEAN_BLOCK_TYPE ||
        block.type == ARGUMENT_REPORTER_NUMBER_BLOCK_TYPE ||
        block.type == ARGUMENT_REPORTER_STRING_BLOCK_TYPE ||
        block.type == ARGUMENT_REPORTER_ARRAY_BLOCK_TYPE ||
        block.type == ARGUMENT_REPORTER_CUSTOM_BLOCK_TYPE
    );
}

export function findUniqueParamName(name: string, paramNames: string[]) {
    while (!isUniqueParamName(name, paramNames)) {
        // Collision with another parameter name.
        name = incrementNameSuffix(name);
    }
    return name;
}

function isUniqueParamName(name: string, paramNames: string[]) {
    if (!paramNames) return true;
    return paramNames.indexOf(name) == -1;
}

export function getShadowBlockInfoFromType_(argumentType: string, ws: Blockly.Workspace) {
    let shadowType = "";
    let fieldName = "";
    let fieldValue = "";
    switch (argumentType) {
        case "boolean":
            shadowType = "logic_boolean";
            fieldName = "BOOL";
            fieldValue = "TRUE";
            break;
        case "number":
            shadowType = "math_number";
            fieldName = "NUM";
            fieldValue = "1";
            break;
        case "string":
            shadowType = "text";
            fieldName = "TEXT";
            fieldValue = "abc";
            break;
        case "Array":
            shadowType = "variables_get";
            fieldName = "VAR";
            fieldValue = Blockly.Variables.getOrCreateVariablePackage(ws, null, "list", "").getId();
            break;
        default:
            // This is probably a custom type. Use a variable as the shadow.
            shadowType = "variables_get";
            fieldName = "VAR";
            fieldValue = Blockly.Variables.getOrCreateVariablePackage(
                ws,
                null,
                FunctionManager.getInstance().getArgumentNameForType(argumentType),
                ""
            ).getId();
    }
    return [shadowType, fieldName, fieldValue];
}

export function flyoutCategory(workspace: Blockly.WorkspaceSvg) {
    const xmlList: Element[] = [];

    // Add the create function button
    const button = document.createElement("button");
    const msg = Blockly.Msg[MsgKey.FUNCTION_CREATE_NEW];
    const callbackKey = "CREATE_FUNCTION";
    button.setAttribute("text", msg);
    button.setAttribute("callbackKey", callbackKey);
    workspace.registerButtonCallback(callbackKey, () => {
        createFunctionCallback(workspace);
    });
    xmlList.push(button);

    // Add the label at the top of the function call blocks
    // const label = Blockly.utils.xml.createElement("label");
    // label.setAttribute("text", Blockly.Msg[MsgKey.FUNCTION_FLYOUT_LABEL]);
    // xmlList.push(label);

    // Populate function call blocks
    for (const func of getAllFunctionDefinitionBlocks(workspace)) {
        const name = func.getName();
        const args = func.getArguments();
        // <block type="function_call" x="25" y="25">
        //   <mutation name="myFunc">
        //     <arg name="bool" type="boolean" id="..."></arg>
        //     <arg name="text" type="string" id="..."></arg>
        //     <arg name="num" type="number" id="..."></arg>
        //   </mutation>
        // </block>
        const block = Blockly.utils.xml.createElement("block");
        block.setAttribute("type", "function_call");
        block.setAttribute("gap", "16");
        const mutation = Blockly.utils.xml.createElement("mutation");
        mutation.setAttribute("name", name);
        block.appendChild(mutation);
        for (let i = 0; i < args.length; i++) {
            const arg = Blockly.utils.xml.createElement("arg");
            arg.setAttribute("name", args[i].name);
            arg.setAttribute("type", args[i].type);
            arg.setAttribute("id", args[i].id);
            mutation.appendChild(arg);
        }
        xmlList.push(block);
    }

    return xmlList;
}


export function validateFunctionExternal(mutation: Element, destinationWs: Blockly.Workspace) {
    // Check for empty function name.
    const funcName = mutation.getAttribute('name');

    if (!funcName) {
        Blockly.dialog.alert(Blockly.Msg.FUNCTION_WARNING_EMPTY_NAME);
        return false;
    }

    // Check for duplicate arg names and empty arg names.
    const seen: StringMap<boolean> = {};
    for (let i = 0; i < mutation.childNodes.length; ++i) {
        const arg = mutation.childNodes[i] as Element;
        const argName = arg.getAttribute('name');
        if (!argName) {
            Blockly.dialog.alert(Blockly.Msg.FUNCTION_WARNING_EMPTY_NAME);
            return false;
        }
        if (seen[argName]) {
            Blockly.dialog.alert(Blockly.Msg.FUNCTION_WARNING_DUPLICATE_ARG);
            return false;
        }
        seen[argName] = true;
    }

    // Check for function name also being an argument name.
    if (seen[funcName]) {
        Blockly.dialog.alert(Blockly.Msg.FUNCTION_WARNING_ARG_NAME_IS_FUNCTION_NAME);
        return false;
    }

    // Check if function name is in use by a variable or another function.
    const funcId = mutation.getAttribute('functionid');
    const usedNames = namesInUse(destinationWs, null, funcId);

    if (usedNames[funcName]) {
        Blockly.dialog.alert(Blockly.Msg.VARIABLE_ALREADY_EXISTS.replace('%1', funcName));
        return false;
    }

    // Looks good.
    return true;
};

function createFunctionCallback(workspace: Blockly.WorkspaceSvg) {
    Blockly.hideChaff();
    if (Blockly.getSelected()) {
        Blockly.getSelected().unselect();
    }
    FunctionManager.getInstance().editFunctionExternal(
        newFunctionMutation(workspace),
        createFunctionCallbackFactory_(workspace)
    );
}

function createFunctionCallbackFactory_(workspace: Blockly.WorkspaceSvg) {
    return function (mutation: Element) {
        if (mutation) {
            const blockText =
                '<xml>' +
                '<block type="' + FUNCTION_DEFINITION_BLOCK_TYPE + '">' +
                Blockly.Xml.domToText(mutation) +
                '</block>' +
                '</xml>';
            const blockDom = Blockly.utils.xml.textToDom(blockText);
            Blockly.Events.setGroup(true);
            const block = Blockly.Xml.domToBlock(blockDom.firstChild as Element, workspace) as CommonFunctionBlock & Blockly.BlockSvg;
            block.updateDisplay_();

            if (workspace.getMetrics) {
                const metrics = workspace.getMetrics();
                const blockDimensions = block.getHeightWidth();
                block.moveBy(
                    metrics.viewLeft + (metrics.viewWidth / 2) - (blockDimensions.width / 2),
                    metrics.viewTop + (metrics.viewHeight / 2) - (blockDimensions.height / 2)
                );
                block.scheduleSnapAndBump();
            }

            workspace.centerOnBlock(block.id);
            Blockly.Events.setGroup(false);

            setTimeout(() => {
                if ((block as (FunctionDefinitionBlock & Blockly.BlockSvg)).afterWorkspaceLoad) {
                    (block as (FunctionDefinitionBlock & Blockly.BlockSvg)).afterWorkspaceLoad();
                }
            });
        }
    };
};

export function isVariableBlockType(type: string) {
    switch (type) {
        case "argument_reporter_boolean":
        case "argument_reporter_number":
        case "argument_reporter_string":
        case "argument_reporter_array":
        case "argument_reporter_custom":
        case "variables_get_reporter":
        case "variables_get":
            return true;
    }
    return false;
}