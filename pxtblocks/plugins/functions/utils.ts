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
import { FunctionCallBlock, SerializedShadow } from "./blocks/functionCallBlocks";
import { isFunctionDefinition } from "../../compiler/util";
import { ArgumentReporterBlock } from "./blocks/argumentReporterBlocks";
import { DRAGGABLE_PARAM_INPUT_PREFIX } from "../../loader";

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
    const block = ws.newBlock(blockType);
    const mutation = Blockly.utils.xml.createElement("mutation");
    mutation.setAttribute("typename", typeName);

    block.domToMutation(mutation);

    return block;
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
    ws.getVariableMap().getAllVariables().forEach(function (v) {
        usedNames[v.getName()] = true;
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
        const oldMutation = definitionBlock.mutationToDom();
        const oldArgNamesToIds = getArgMap(oldMutation, false);
        const idsToNewArgNames = getArgMap(mutation, true);

        const changedDescendants: DescendantChange[] = [];

        for (const block of definitionBlock.getDescendants(false)) {
            if (!isFunctionArgumentReporter(block)) continue;

            const argumentOwner = getArgumentReporterParent(block, block);

            if (argumentOwner && argumentOwner !== definitionBlock) continue;

            const oldName = block.getFieldValue("VALUE");
            const oldArgId = oldArgNamesToIds[oldName];
            const newName = idsToNewArgNames[oldArgId];

            // no change
            if (oldName === newName) continue;

            const targetBlockId = block.outputConnection.targetBlock().id;
            const targetInputName = block.outputConnection.targetConnection.getParentInput().name;

            changedDescendants.push({
                id: block.id,
                type: block.type,
                oldName,
                newName,
                targetBlockId,
                targetInputName,
            });
        }

        const callerChanges = getCallers(name, definitionBlock.workspace)
            .map(caller => ({
                id: caller.id,
                oldMutation: Blockly.utils.xml.domToText(caller.mutationToDom()),
                shadows: (caller as FunctionCallBlock).serializeChangedInputs(mutation)
            } as CallerChange))

        const change = new MutateFunctionEvent(
            definitionBlock.id,
            callerChanges,
            Blockly.Xml.domToText(oldMutation),
            Blockly.Xml.domToText(mutation),
            changedDescendants
        );

        change.workspaceId = ws.id;

        change.run(true);
        Blockly.Events.fire(change);
    } else {
        pxt.warn("Attempted to change function " + name + ", but no definition block was found on the workspace");
    }
}

export function getArgMap(mutation: Element, inverse: boolean) {
    const map: StringMap<string> = {};
    for (let i = 0; i < mutation.childNodes.length; ++i) {
        const arg = mutation.childNodes[i] as Element;
        const key = inverse ? arg.getAttribute("id") : arg.getAttribute("name");
        const val = inverse ? arg.getAttribute("name") : arg.getAttribute("id");
        map[key!] = val!;
    }
    return map;
}

export function isFunctionArgumentReporter(block: Blockly.Block) {
    return (
        block.type == ARGUMENT_REPORTER_BOOLEAN_BLOCK_TYPE ||
        block.type == ARGUMENT_REPORTER_NUMBER_BLOCK_TYPE ||
        block.type == ARGUMENT_REPORTER_STRING_BLOCK_TYPE ||
        block.type == ARGUMENT_REPORTER_ARRAY_BLOCK_TYPE ||
        block.type == ARGUMENT_REPORTER_CUSTOM_BLOCK_TYPE
    );
}

export function doArgumentReporterDragChecks(a: Blockly.RenderedConnection, b: Blockly.RenderedConnection, distance: number) {
    const draggedBlock = a.getSourceBlock();

    if (!isFunctionArgumentReporter(draggedBlock)) {
        return true;
    }

    const destinationBlock = b.getSourceBlock();

    // this shouldn't happen, but if it does then we should let the default connection checker handle it
    if (!destinationBlock) {
        return true;
    }

    return !!(getArgumentReporterParent(draggedBlock, destinationBlock));
}

export function getArgumentReporterParent(reporter: Blockly.Block, location: Blockly.Block): Blockly.Block | undefined {
    pxt.U.assert(isFunctionArgumentReporter(reporter));

    const varName = reporter.getFieldValue("VALUE");
    const varType = (reporter as ArgumentReporterBlock).getTypeName();

    while (location.getSurroundParent()) {
        location = location.getSurroundParent();

        // check to see if this is a callback with draggable reporters
        for (const input of location.inputList) {
            if (!input.connection || !input.name.startsWith(DRAGGABLE_PARAM_INPUT_PREFIX)) continue;

            const name = input.name.slice(DRAGGABLE_PARAM_INPUT_PREFIX.length);
            if (name !== varName) continue;

            // blockly primitive types are capitalized
            let toCheck = varType;
            if (toCheck === "string" || toCheck === "number" || toCheck === "boolean") {
                toCheck = toCheck.charAt(0).toUpperCase() + toCheck.slice(1);
            }

            if (input.connection.getCheck().indexOf(toCheck) !== -1) {
                return location;
            }

            // bail out, even if there is a chance that a parent higher up in the stack could
            // have a matching argument. we don't allow shadowing of arguments with
            // different types
            return undefined;
        }
    }

    // if disabled, this block must be an orphaned block on the workspace. connecting
    // function parameters to these blocks can be useful when refactoring, so allow
    // the connection
    if (!location.isEnabled()) {
        return location;
    }

    // for functions, make sure the function has a parameter with this same name and type
    if (isFunctionDefinition(location)) {
        const functionArgs = (location as unknown as FunctionDefinitionBlock).getArguments();

        if (functionArgs.some(arg => arg.name === varName && arg.type === varType)) {
            return location;
        }
    }

    return undefined;
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

            workspace.centerOnBlock(block.id, true);
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

interface DescendantChange {
    id: string;
    type: string;
    oldName: string;
    newName?: string;
    targetBlockId: string;
    targetInputName: string;
}

interface CallerChange {
    id: string;
    oldMutation: string;
    shadows: SerializedShadow[];
}


interface MutateFunctionEventJson extends Blockly.Events.AbstractEventJson {
    definition: string;
    callers: CallerChange[];
    oldMutation: string;
    newMutation: string;
    descendantChanges: DescendantChange[];
}

class MutateFunctionEvent extends Blockly.Events.Abstract {
    isBlank: boolean;

    type = "pxt_mutate_function"

    static fromJson(
        json: MutateFunctionEventJson,
        workspace: Blockly.Workspace,
        event?: any,
    ) {
        event = super.fromJson(
            json,
            workspace,
            event || new MutateFunctionEvent(
                json.definition,
                json.callers,
                json.oldMutation,
                json.newMutation,
                json.descendantChanges
            )
        );

        const existing = event as MutateFunctionEvent;
        existing.definition = json.definition;
        existing.callers = json.callers;
        existing.oldMutation = json.oldMutation;
        existing.newMutation = json.newMutation;
        existing.descendantChanges = json.descendantChanges;

        return event;
    }

    constructor(
        protected definition: string,
        protected callers: CallerChange[],
        protected oldMutation: string,
        protected newMutation: string,
        protected descendantChanges: DescendantChange[]
    ) {
        super();
    }

    toJson(): MutateFunctionEventJson {
        return {
            type: this.type,
            group: this.group,
            definition: this.definition,
            callers: this.callers,
            oldMutation: this.oldMutation,
            newMutation: this.newMutation,
            descendantChanges: this.descendantChanges
        }
    }

    run(forward: boolean) {
        const ws = this.getEventWorkspace_();
        const mutation = Blockly.utils.xml.textToDom(forward ? this.newMutation : this.oldMutation);
        const def = ws.getBlockById(this.definition) as FunctionDefinitionBlock;

        Blockly.Events.disable();

        def.domToMutation(mutation);
        def.updateArgumentInputs_();
        def.afterWorkspaceLoad();

        for (const change of this.callers) {
            const caller = ws.getBlockById(change.id);

            if (forward) {
                caller.domToMutation(mutation);
            }
            else {
                caller.domToMutation(Blockly.utils.xml.textToDom(change.oldMutation));

                for (const inputChange of change.shadows) {
                    if (inputChange.connectedBlock) {
                        const block = ws.getBlockById(inputChange.connectedBlock);
                        caller.getInput(inputChange.inputName).connection.connect(block.outputConnection);
                    }
                    else {
                        caller.getInput(inputChange.inputName).connection.setShadowState(inputChange.connectedShadow);
                    }
                }
            }
        }

        for (const change of this.descendantChanges) {
            if (change.newName) {
                const block = ws.getBlockById(change.id);
                block.setFieldValue(forward ? change.newName : change.oldName, "VALUE");
            }
            else if (forward) {
                const block = ws.getBlockById(change.id);

                if (block) {
                    block.dispose();
                }
            }
            else {
                const newBlock = ws.newBlock(change.type, change.id) as Blockly.BlockSvg;
                newBlock.setFieldValue(change.oldName, "VALUE");
                newBlock.initSvg();
                const target = ws.getBlockById(change.targetBlockId);

                const targetConnection = target.getInput(change.targetInputName).connection;

                const toBeReplaced = targetConnection.targetBlock();
                if (toBeReplaced) {
                    if (!toBeReplaced.isShadow()) {
                        toBeReplaced.dispose();
                    }
                }
                targetConnection.connect(newBlock.outputConnection);
            }
        }

        Blockly.Events.enable();
    }
}